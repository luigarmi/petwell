$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param([string]$Path)

  $map = @{}
  Get-Content $Path | ForEach-Object {
    if (-not $_ -or $_.StartsWith("#")) {
      return
    }

    $parts = $_.Split("=", 2)
    if ($parts.Length -eq 2) {
      $map[$parts[0].Trim()] = $parts[1].Trim()
    }
  }

  return $map
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [string]$Token = ""
  )

  $headers = @{
    "Accept" = "application/json"
  }

  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Method = $Method
    Uri = $Url
    Headers = $headers
    ContentType = "application/json"
  }

  if ($null -ne $Body) {
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }

  return Invoke-RestMethod @params
}

function Wait-ForHttp {
  param([string]$Url, [int]$TimeoutSeconds = 180)

  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
    try {
      $response = Invoke-RestMethod -Method GET -Uri $Url
      if ($response.status -eq "ok") {
        return
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  }

  throw "Timeout waiting for $Url"
}

function Wait-ForCondition {
  param([scriptblock]$Action, [scriptblock]$Check, [int]$TimeoutSeconds = 60)

  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
    try {
      $value = & $Action
      if (& $Check $value) {
        return $value
      }
    } catch {
    }
    Start-Sleep -Seconds 2
  }

  throw "Condition timeout exceeded."
}

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
  throw "No existe .env. Copia .env.example a .env antes de ejecutar la prueba."
}

$config = Read-EnvFile $envFile
$apiBase = $config["PETWELL_API_BASE"]
if (-not $apiBase) {
  $apiBase = "http://localhost:8080"
}

$bootstrapAdminEmail = $config["BOOTSTRAP_ADMIN_EMAIL"]
$bootstrapAdminPassword = $config["BOOTSTRAP_ADMIN_PASSWORD"]

Write-Host "Esperando gateway en $apiBase/health ..."
Wait-ForHttp "$apiBase/health"

$seed = Get-Date -Format "yyyyMMddHHmmss"
$ownerEmail = "owner.$seed@petwell.local"
$clinicAdminEmail = "clinic.$seed@petwell.local"
$vetEmail = "vet.$seed@petwell.local"
$password = "PetWell123!"

Write-Host "1/10 Registrando usuarios públicos"
$ownerRegister = Invoke-Api "POST" "$apiBase/users/register" @{
  email = $ownerEmail
  phone = "300100$seed".Substring(0, 10)
  password = $password
  fullName = "Owner $seed"
}

$clinicRegister = Invoke-Api "POST" "$apiBase/users/register" @{
  email = $clinicAdminEmail
  phone = "300200$seed".Substring(0, 10)
  password = $password
  fullName = "Clinic Admin $seed"
}

$vetRegister = Invoke-Api "POST" "$apiBase/users/register" @{
  email = $vetEmail
  phone = "300300$seed".Substring(0, 10)
  password = $password
  fullName = "Vet $seed"
}

Write-Host "2/10 Iniciando sesión como ADMIN bootstrap"
$adminLogin = Invoke-Api "POST" "$apiBase/users/login" @{
  email = $bootstrapAdminEmail
  password = $bootstrapAdminPassword
}
$adminToken = $adminLogin.token

Write-Host "3/10 Asignando roles elevados"
Invoke-Api "PUT" "$apiBase/users/admin/users/$($clinicRegister.user.id)/roles" @{
  roles = @("CLINIC_ADMIN")
} $adminToken | Out-Null

Invoke-Api "PUT" "$apiBase/users/admin/users/$($vetRegister.user.id)/roles" @{
  roles = @("VET")
} $adminToken | Out-Null

Write-Host "4/10 Creando clínica y vinculando staff"
$clinic = Invoke-Api "POST" "$apiBase/users/clinics" @{
  legalName = "PetWell Clinic $seed"
  taxId = "PW-$seed"
  address = "Calle 1 # 2-3"
} $adminToken

$clinicId = $clinic.clinic.id

Invoke-Api "POST" "$apiBase/users/clinics/$clinicId/staff" @{
  userId = $clinicRegister.user.id
  staffRole = "CLINIC_ADMIN"
} $adminToken | Out-Null

Invoke-Api "POST" "$apiBase/users/clinics/$clinicId/staff" @{
  userId = $vetRegister.user.id
  staffRole = "VET"
} $adminToken | Out-Null

$clinicAdminLogin = Invoke-Api "POST" "$apiBase/users/login" @{
  email = $clinicAdminEmail
  password = $password
}
$clinicAdminToken = $clinicAdminLogin.token

$vetLogin = Invoke-Api "POST" "$apiBase/users/login" @{
  email = $vetEmail
  password = $password
}
$vetToken = $vetLogin.token

$ownerToken = $ownerRegister.token

Write-Host "5/10 Registrando mascota y consentimiento"
$pet = Invoke-Api "POST" "$apiBase/pets" @{
  name = "Luna"
  species = "Canina"
  breed = "Mestiza"
  primaryClinicId = $clinicId
} $ownerToken
$petId = $pet.pet.id

Invoke-Api "POST" "$apiBase/ehr/consents" @{
  petId = $petId
  clinicId = $clinicId
  scope = "Acceso clínico completo"
} $ownerToken | Out-Null

Write-Host "6/10 Creando horario y cita TELEMED"
$startUtc = [DateTime]::UtcNow.Date.AddDays(1).AddHours(15)
$endUtc = $startUtc.AddMinutes(30)
$dayOfWeek = [int]$startUtc.DayOfWeek

Invoke-Api "POST" "$apiBase/appointments/schedules" @{
  clinicId = $clinicId
  vetUserId = $vetRegister.user.id
  dayOfWeek = $dayOfWeek
  start = "15:00"
  end = "18:00"
  slotMinutes = 30
} $clinicAdminToken | Out-Null

$appointment = Invoke-Api "POST" "$apiBase/appointments" @{
  petId = $petId
  clinicId = $clinicId
  vetUserId = $vetRegister.user.id
  type = "TELEMED"
  startTime = $startUtc.ToString("o")
  endTime = $endUtc.ToString("o")
} $ownerToken
$appointmentId = $appointment.appointment.id

Write-Host "7/10 Procesando pago"
Invoke-Api "POST" "$apiBase/payments" @{
  appointmentId = $appointmentId
  amount = 95000
  provider = "SIMULATED"
} $ownerToken | Out-Null

$confirmedAppointment = Wait-ForCondition `
  -Action { Invoke-Api "GET" "$apiBase/appointments/$appointmentId" $null $ownerToken } `
  -Check { param($response) $response.appointment.status -eq "CONFIRMED" }

Write-Host "8/10 Registrando record clínico y completando cita"
Invoke-Api "POST" "$apiBase/ehr/records" @{
  petId = $petId
  clinicId = $clinicId
  reason = "Control general"
  notes = "Paciente estable, hidratado y con evolución favorable."
} $vetToken | Out-Null

Invoke-Api "POST" "$apiBase/appointments/$appointmentId/complete" @{} $vetToken | Out-Null

Write-Host "9/10 Verificando factura, telemedicina, notificaciones y analytics"
$billing = Invoke-Api "GET" "$apiBase/payments/$appointmentId" $null $ownerToken
$telemed = Wait-ForCondition `
  -Action { Invoke-Api "GET" "$apiBase/telemed/rooms/$appointmentId" $null $ownerToken } `
  -Check { param($response) $null -ne $response.room }

$ownerNotifications = Wait-ForCondition `
  -Action { Invoke-Api "GET" "$apiBase/notifications" $null $ownerToken } `
  -Check { param($response) $response.notifications.Count -ge 3 }

$analytics = Wait-ForCondition `
  -Action { Invoke-Api "GET" "$apiBase/analytics/summary" $null $clinicAdminToken } `
  -Check { param($response) $null -ne $response.global }

Write-Host "10/10 Smoke test completado"
Write-Host "Owner:" $ownerEmail
Write-Host "Clinic:" $clinicId
Write-Host "Pet:" $petId
Write-Host "Appointment:" $confirmedAppointment.appointment.id "Status:" $confirmedAppointment.appointment.status
Write-Host "Invoice:" $billing.invoice.id "Total:" $billing.invoice.total
Write-Host "Telemed room:" $telemed.room.roomCode
Write-Host "Notifications:" $ownerNotifications.notifications.Count
Write-Host "Analytics revenue:" $analytics.global.revenue
