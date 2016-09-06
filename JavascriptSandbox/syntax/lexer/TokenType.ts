'use strict';

enum TokenType {
    Identifier,
    NumericLiteral,
    Punctuator,
	RegularExpression,
    StringLiteral,
	// Special:
	// TODO: rename to EndOfFile and IllegalCharacter
	EOF,		// End of file
	ILLEGAL		// Illegal character
}

Object.freeze ( TokenType );