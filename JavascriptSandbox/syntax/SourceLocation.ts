'use strict';

interface SourcePosition {
	line : number;		// Integer, >= 1.
	column : number;	// Integer, >= 0.
	index : number;		// Integer, >= 0.
}

interface SourceLocation {
	source : string;	// Should be string or null.
	start : SourcePosition;
	end : SourcePosition;
}