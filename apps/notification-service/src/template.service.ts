import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateService {
  private templates: Record<string, { subject: string; body: string }> = {
    'password-reset': {
      subject: 'Recupera tu acceso a PetWell',
      body: 'Hola {{firstName}}, usa este enlace para restablecer tu clave: {{resetUrl}}'
    },
    'appointment-confirmed': {
      subject: 'Tu cita PetWell fue confirmada',
      body: 'Hola {{firstName}}, tu cita quedó confirmada para {{startsAt}}.'
    },
    'appointment-cancelled': {
      subject: 'Tu cita PetWell fue cancelada',
      body: 'Hola {{firstName}}, tu cita fue cancelada. Motivo: {{reason}}.'
    },
    'payment-failed': {
      subject: 'Tu pago PetWell no fue aprobado',
      body: 'Hola {{firstName}}, tu pago no se pudo completar. Puedes reintentarlo desde tu historial.'
    },
    'telemed-room': {
      subject: 'Acceso a tu teleconsulta PetWell',
      body: 'Hola {{firstName}}, tu sala virtual está lista: {{roomUrl}}'
    },
    'reminder-24h': {
      subject: 'Recordatorio PetWell: tu cita es mañana',
      body: 'Hola {{firstName}}, te recordamos tu cita programada para {{startsAt}}.'
    },
    'reminder-2h': {
      subject: 'Recordatorio PetWell: tu cita inicia pronto',
      body: 'Hola {{firstName}}, tu cita inicia a las {{startsAt}}.'
    },
    'pet-birthday': {
      subject: 'PetWell celebra el cumpleanos de {{petName}}',
      body: 'Hola {{firstName}}, {{petName}} cumple anos el {{birthdayDate}}. Te recomendamos revisar vacunas, desparasitacion y su proximo control.'
    }
  };

  render(templateName: string, variables: Record<string, string | number>) {
    const template = this.templates[templateName] ?? {
      subject: templateName,
      body: JSON.stringify(variables, null, 2)
    };

    const interpolate = (content: string) =>
      Object.entries(variables).reduce(
        (accumulator, [key, value]) => accumulator.replaceAll(`{{${key}}}`, String(value)),
        content
      );

    return {
      subject: interpolate(template.subject),
      body: interpolate(template.body)
    };
  }
}
