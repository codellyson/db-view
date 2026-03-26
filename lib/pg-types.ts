/**
 * Map PostgreSQL type OIDs to human-readable names.
 * Covers the most common built-in types.
 */
const PG_TYPE_MAP: Record<number, string> = {
  16: 'boolean',
  17: 'bytea',
  18: 'char',
  20: 'bigint',
  21: 'smallint',
  23: 'integer',
  25: 'text',
  26: 'oid',
  114: 'json',
  142: 'xml',
  600: 'point',
  700: 'real',
  701: 'double precision',
  790: 'money',
  869: 'inet',
  1042: 'character',
  1043: 'character varying',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamp with time zone',
  1186: 'interval',
  1266: 'time with time zone',
  1560: 'bit',
  1562: 'bit varying',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
  3904: 'int4range',
  3906: 'numrange',
  3908: 'tsrange',
  3910: 'tstzrange',
  3912: 'daterange',
  3926: 'int8range',
};

export function pgOidToType(oid: number): string {
  return PG_TYPE_MAP[oid] || `type(${oid})`;
}
