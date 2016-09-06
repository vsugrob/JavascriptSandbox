'use strict';

enum IdentifierKind {
	// false, true
	BooleanLiteral,
	// class, const, enum, export, extends, import, super
	FutureReservedWord,
	/* break, case, catch, continue, debugger, default,
	 * delete, do, else, finally, for, function, if, in,
	 * instanceof, new, return, switch, this, throw, try,
	 * typeof, var, void, while, with */
	Keyword,
	// Variable/function name.
	Name,
	// null
	NullLiteral,
	/* implements, interface, let, package,
	 * private, public, yield */
	StrictFutureReservedWord
}

Object.freeze ( IdentifierKind );