export class ApiError extends Error {
  constructor(key, status = 500, message) { super(message || key); this.key = key; this.status = status; this.name = key }
}
