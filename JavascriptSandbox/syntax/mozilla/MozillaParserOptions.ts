/// <reference path="AstBuilder.ts" />
'use strict';

interface MozillaParserOptions {
	/** When loc is true, the parser includes source location information
	  * in the returned AST nodes.
	  * Default: true. */
	loc? : bool;
	/** A description of the input source; typically a filename, path, or URL.
	  * This string is not meaningful to the parsing process,
	  * but is produced as part of the source location information in the returned AST nodes.
	  * Default: null. */
	source? : string;
	/** The initial line number to use for source location information.
	  * Default: 1. */
	line? : number;
	/** A builder object, which can be used to produce AST nodes in custom data formats.
	  * See AstBuilder interface for information about expected callback methods.
	  * Default: null. */
	builder? : AstBuilder;
}