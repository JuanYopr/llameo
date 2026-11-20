import { expect, test } from 'vitest';
import { offsetFromFileName, takeFileName } from './take-file';

test('take file name carries the signed offset and a safe output label', () => {
  expect(takeFileName('el-pescador', 232, 'AirPods Pro')).toBe('toma_el-pescador_+232ms_airpods-pro.wav');
  expect(takeFileName('caliente', -15, 'default')).toBe('toma_caliente_-15ms_default.wav');
});

test('offset round-trips through the file name', () => {
  expect(offsetFromFileName(takeFileName('el-pescador', 2656, 'Wired'))).toBe(2656);
  expect(offsetFromFileName('toma_caliente_-15ms_default.wav')).toBe(-15);
  expect(offsetFromFileName('mi-grabacion.wav')).toBeNull();
});
