/// <reference path="Lexer.ts" />
'use strict';

class CommentNode {
	constructor (
		// Block comment when true: '/*text*/'.
		// Single line comment when false : '//text'.
		public isBlockComment : bool,
		public text : string,
		public loc : SourceLocation
	) {}

	public static readSingleLineComment ( lexer : Lexer ) {
		if ( Lexer.DEBUG )
			System.assert ( lexer.code [lexer.index] === '/' && lexer.code [lexer.index + 1] === '/' );

		var start = lexer.index;
		lexer.index += 2;

		while ( lexer.index < lexer.length ) {
			var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

			if ( cc === 0xa /*<LF>*/ || cc === 0xd /*<CR>*/ ||
				 cc === 0x2028 /*LINE SEPARATOR <LS>*/ ||
				 cc === 0x2029 /*PARAGRAPH SEPARATOR <PS>*/ )
			{
				break;
			}

			lexer.index++;
		}

		if ( lexer.collectComments ) {
			var comment = new CommentNode (
				false,	// isBlockComment
				Lexer.builtin.substring.call ( lexer.code, start + 2, lexer.index ),
				{
					source : lexer.sourcePath,
					start : {
						line : lexer.line,
						column : start - lexer.lineStartIndex,
						index : start
					},
					end : {
						line : lexer.line,
						column : lexer.index - lexer.lineStartIndex,
						index : lexer.index
					},
				}
			);

			Lexer.builtin.push.call ( lexer.comments, comment );
		}
	}

	public static readMultiLineComment ( lexer : Lexer ) {
		if ( Lexer.DEBUG )
			System.assert ( lexer.code [lexer.index] === '/' && lexer.code [lexer.index + 1] === '*' );

		var startIndex = lexer.index;
		lexer.index += 2;
		var endIndex = -1,
			startLine = lexer.line,
			prevChIsAsterisk = false;

		while ( lexer.index < lexer.length ) {
			var cc = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index );

			if ( cc === 0xa /*<LF>*/ ||
				 cc === 0x2028 /*LINE SEPARATOR <LS>*/ ||
				 cc === 0x2029 /*PARAGRAPH SEPARATOR <PS>*/ )
			{
				prevChIsAsterisk = false;
				lexer.newline ( lexer.index + 1 );
			} else if ( cc === 0xd /*<CR>*/ ) {
				prevChIsAsterisk = false;
				var ccNext = Lexer.builtin.charCodeAt.call ( lexer.code, lexer.index + 1 );

				if ( ccNext === 0xa /*<LF>*/ )
					lexer.index++;

				lexer.newline ( lexer.index + 1 );
			} else if ( cc === 0x2a /***/ )
				prevChIsAsterisk = true;
			else if ( cc === 0x2f /*/*/ && prevChIsAsterisk ) {
				// We've got '*/' character sequence, it signifies end of comment.
				endIndex = lexer.index - 1;
				lexer.index++;
				break;
			} else
				prevChIsAsterisk = false;

			lexer.index++;
		}

		if ( endIndex === -1 ) {	// There was no '*/' character sequence, comment wasn't properly finished.
			lexer.throwEofOrIllegal (
				'block comment',
				'termination sequence */'
			);
		}

		if ( lexer.collectComments ) {
			var comment = new CommentNode (
				true,	// isBlockComment
				Lexer.builtin.substring.call ( lexer.code, startIndex + 2, endIndex ),
				{
					source : lexer.sourcePath,
					start : {
						line : startLine,
						column : startIndex - lexer.lineStarts [startLine],
						index : startIndex
					},
					end : {
						line : lexer.line,
						column : lexer.index - lexer.lineStartIndex,
						index : lexer.index
					},
				}
			);

			Lexer.builtin.push.call ( lexer.comments, comment );
		}
	}
}

System.breakPrototypeChain ( StringToken );