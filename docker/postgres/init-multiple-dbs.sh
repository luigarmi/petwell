#!/bin/sh
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE petwell_user;
  CREATE DATABASE petwell_pet;
  CREATE DATABASE petwell_ehr;
  CREATE DATABASE petwell_appointment;
  CREATE DATABASE petwell_billing;
  CREATE DATABASE petwell_telemed;
  CREATE DATABASE petwell_notification;
  CREATE DATABASE petwell_analytics;
EOSQL
