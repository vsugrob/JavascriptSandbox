'use strict';

enum NumericTokenKind {
	Integer,
	Fractional,
	Exponential,
	Octal,
	Hexadecimal
}

Object.freeze ( NumericTokenKind );