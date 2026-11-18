// Erreurs au format PostgREST : { code, message, details, hint }.
export class ApiError extends Error {
  constructor(status, code, message, details = null, hint = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
  toJSON() {
    return { code: this.code, details: this.details, hint: this.hint, message: this.message };
  }
}

export const badRequest = (message, code = 'PGRST100', details = null) => new ApiError(400, code, message, details);

/** Convertit une erreur Postgres en réponse HTTP (mêmes statuts que PostgREST). */
export function fromPgError(err, role) {
  const code = err.code ?? 'XX000';
  let status = 500;
  if (code === '42501') status = role === 'anon' ? 401 : 403;
  else if (code === '23505' || code === '23503') status = 409;
  else if (code === '42P01' || code === '42883') status = 404;
  else if (code === '57014') status = 500;
  else if (/^(22|23|42|44|P0|2D|38|39|3B|40|54|0A|21|25|28|2F|34|3D|3F)/.test(code)) status = 400;
  return new ApiError(status, code, err.message, err.detail ?? null, err.hint ?? null);
}
