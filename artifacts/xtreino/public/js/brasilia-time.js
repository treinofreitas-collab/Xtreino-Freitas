(function (root) {
  'use strict';

  const TIME_ZONE = 'America/Sao_Paulo';
  const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function partsAt(instant = Date.now()) {
    const date = instant instanceof Date ? instant : new Date(instant);
    const parts = Object.fromEntries(
      dateTimeFormatter.formatToParts(date)
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, Number(part.value)]),
    );
    return parts;
  }

  function dateKey(instant = Date.now()) {
    const { year, month, day } = partsAt(instant);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isValidDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  function addDays(value, amount) {
    if (!isValidDateKey(value) || !Number.isInteger(amount)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function weekday(value) {
    if (!isValidDateKey(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  // Converts a Brasília wall-clock event time to an instant without relying on
  // the browser's local timezone.
  function minutesUntil(value, hour, instant = Date.now()) {
    if (!isValidDateKey(value) || !Number.isInteger(Number(hour))
        || Number(hour) < 0 || Number(hour) > 23) return NaN;
    const [year, month, day] = value.split('-').map(Number);
    const targetWallClock = Date.UTC(year, month - 1, day, Number(hour));
    let eventInstant = targetWallClock;
    for (let i = 0; i < 4; i += 1) {
      const local = partsAt(eventInstant);
      const representedWallClock = Date.UTC(
        local.year, local.month - 1, local.day,
        local.hour, local.minute, local.second,
      );
      const correction = targetWallClock - representedWallClock;
      eventInstant += correction;
      if (correction === 0) break;
    }
    const nowMs = instant instanceof Date ? instant.getTime() : Number(instant);
    return (eventInstant - nowMs) / 60000;
  }

  function formatDate(value, options = {}) {
    if (!isValidDateKey(value)) return value || '';
    return new Date(`${value}T12:00:00.000Z`).toLocaleDateString('pt-BR', {
      ...options,
      timeZone: 'UTC',
    });
  }

  root.BrasiliaTime = Object.freeze({
    timeZone: TIME_ZONE,
    dateKey,
    isValidDateKey,
    addDays,
    weekday,
    minutesUntil,
    formatDate,
  });
})(window);
