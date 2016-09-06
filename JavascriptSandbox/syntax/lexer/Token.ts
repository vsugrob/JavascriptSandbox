/// <reference path="TokenType.ts" />
/// <reference path="../SourceLocation.ts" />
'use strict';

interface Token {
	type : TokenType;
	kind : number;
	value : any;
	loc : SourceLocation;
	prev : Token;
	next : Token;
}