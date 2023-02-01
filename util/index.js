import { createHash } from 'crypto'

export function getSubstringAfterUnderscore(str) {
  var index = str.indexOf("_");
  if (index === -1) {
    return "";
  } else {
    return str.substring(index + 1);
  }
}

export function hashResponseBody(content) {
  return createHash('md5').update(JSON.stringify(content)).digest('hex');
}

export class NotFoundError extends Error {
  constructor() {
    super();
    this.name = 'NotFoundError';
    this.message = 'Requested resource does not exist.'
  }

};

export class AuthorNotFoundError extends Error {
  constructor() {
    super();
    this.name = "AuthorNotFoundError";
    this.message = "This author ID does not exist. Please add it first or try Adding a new author and book."
  }
}

export class BookNotFoundError extends Error {
  constructor() {
    super();
    this.name = "BookNotFoundError";
    this.message = "This book ID does not exist. Are you sure you requested the right ID?"
  }
}