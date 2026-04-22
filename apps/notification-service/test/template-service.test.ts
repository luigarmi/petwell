import assert from 'node:assert/strict';
import test from 'node:test';

import { TemplateService } from '../src/template.service';

test('template service interpolates placeholders', () => {
  const service = new TemplateService();
  const rendered = service.render('appointment-confirmed', {
    firstName: 'Ana',
    startsAt: '2026-04-21T14:00:00.000Z'
  });

  assert.equal(rendered.subject.includes('confirmada'), true);
  assert.equal(rendered.body.includes('Ana'), true);
});

test('template service renders pet birthday reminders', () => {
  const service = new TemplateService();
  const rendered = service.render('pet-birthday', {
    firstName: 'Ana',
    petName: 'Luna',
    birthdayDate: '2026-04-24T00:00:00.000Z'
  });

  assert.equal(rendered.subject.includes('Luna'), true);
  assert.equal(rendered.body.includes('cumple anos'), true);
  assert.equal(rendered.body.includes('2026-04-24'), true);
});
