'use strict';

/* This enum was derived from
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence#Table */
enum OpPrecedence {
	Member = 1,			// . []
	New = 1,			// new
	Call = 2,			// ()
	Update = 3,			// ++ --
	Unary = 4,			// ! ~ + - typeof void delete
	MulDivMod = 5,		// * / %
	AddSub = 6,			// + -
	BitShift = 7,		// << >> >>>
	Relational = 8,		// < <= > >= in instanceof
	Equality = 9,		// == != === !==
	BitAnd = 10,		// &
	BitXor = 11,		// ^
	BitOr = 12,			// |
	LogicalAnd = 13,	// &&
	LogicalOr = 14,		// ||
	Conditional = 15,	// ?:
	Yield = 16,			// yield
	Assignment = 17,	// = += -= *= /= %= <<= >>= >>>= &= ^= |=
	Comma = 18,			// ,
	Least = 19			// Useful in precedence comparison.
}

Object.freeze ( OpPrecedence );