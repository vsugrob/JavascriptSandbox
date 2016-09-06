'use strict';

enum Punctuator {
	LCurly,			//  {
	RCurly,			//  }
	LParen,			//  (
	RParen,			//  )
	LBracket,		//  [
	RBracket,		//  ]
	Dot,			//  .
	Semicolon,		//  ;
	Comma,			//  ,
	Lt,				//  <
	Gt,				//  >
	LtOrEq,			//  <=
	GtOrEq,			//  >=
	Eq,				//  ==
	NotEq,			//  !=
	StrictEq,		//  ===
	StrictNotEq,	//  !==
	Plus,			//  +
	Minus,			//  -
	Multiply,		//  *
	Modulo,			//  %
	Increase,		//  ++
	Decrease,		//  --
	LShift,			//  <<
	RShift,			//  >>
	URShift,		//  >>>
	BitAnd,			//  &
	BitOr,			//  |
	BitXor,			//  ^
	Not,			//  !
	BitNot,			//  ~
	And,			//  &&
	Or,				//  ||
	Question,		//  ?
	Colon,			//  :
	Assign,			//  =
	PlusAssign,		//  +=
	MinusAssign,	//  -=
	MultiplyAssign,	//  *=
	ModuloAssign,	//  %=
	LShiftAssign,	//  <<=
	RShiftAssign,	//  >>=
	URShiftAssign,	//  >>>=
	BitAndAssign,	//  &=
	BitOrAssign,	//  |=
	BitXorAssign,	//  ^=
	Divide,			//  /
	DivideAssign,	//  /=
	/** A slash that may be either division '/', '/='
	  * or starting delimiter of regular expression.
	  * Such token must be resolved into one of the
	  * these kinds before being used. */
	AmbiguousSlash,	//	/
}

Object.freeze ( Punctuator );