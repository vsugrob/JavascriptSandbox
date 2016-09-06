/// <reference path="../../syntax/parser/Parser.ts" />

var zip = window ['zip'];
zip.workerScriptsPath = 'third-party/gildas-lormeau-zip.js/';

var zipEntries : any [],
	printSuccessfulComparisons = false,
	esParser = window ['esprima'],
	myParser = new Parser (),
	contentElt : HTMLElement,
	totalNumNodesElt : HTMLElement,
	totalNumLinesElt : HTMLElement,
	totalSizeElt : HTMLElement,
	myParserKbytesPerSecElt : HTMLElement,
	numErrorsElt : HTMLElement,
	numDifferencesElt : HTMLElement,
	timeElapsedElt : HTMLElement,
	currentFileElt : HTMLElement,
	progressElt : HTMLElement,
	timeElapsed = 0,
	myParserTimeElapsed = 0,
	numNodes : number,
	totalNumNodes = 0,
	totalNumLines = 0,
	totalSizeInBytes = 0,
	numDifferences = 0,
	numErrors = 0,
	fileIdx = 0;

window.onload = function () {
	contentElt = document.getElementById ( 'content' );
	totalNumNodesElt = document.getElementById ( 'totalNumNodes' );
	totalNumLinesElt = document.getElementById ( 'totalNumLines' );
	totalSizeElt = document.getElementById ( 'totalSize' );
	myParserKbytesPerSecElt = document.getElementById ( 'myParserKbytesPerSec' );
	numErrorsElt = document.getElementById ( 'numErrors' );
	numDifferencesElt = document.getElementById ( 'numDifferences' );
	timeElapsedElt = document.getElementById ( 'timeElapsed' );
	currentFileElt = document.getElementById ( 'currentFile' );
	progressElt = document.getElementById ( 'progress' );

	var httpReader = new zip.HttpReader ( 'http://localhost:22212/tests/parser/test-scripts/cdnjs.zip' );
		
	zip.createReader ( httpReader, function ( zipReader ) {
		zipReader.getEntries ( function ( entries ) {
			zipEntries = entries;

			// Filter js files
			for ( var i = zipEntries.length - 1 ; i >= 0 ; i-- ) {
				var zipEntry = zipEntries [i];

				if ( !/\.js$/.test ( zipEntry.filename ) )
					zipEntries.splice ( i, 1 );
			}

			processFile ();
		} );
	}, function ( ex ) {
		writeLine ( 'Error loading zipped archive of test files. ' + ex );
	} );
};

function write ( line : string, cssClass? : string ) {
	var lineElt = document.createElement ( 'span' );
	lineElt.innerText = line;

	if ( typeof cssClass === 'string' )
		lineElt.className = cssClass;

	contentElt.appendChild ( lineElt );
}

function writeLine ( line : string, cssClass? : string ) {
	var lineElt = document.createElement ( 'span' );
	lineElt.innerText = line + '\n';

	if ( typeof cssClass === 'string' )
		lineElt.className = cssClass;

	contentElt.appendChild ( lineElt );
}

function writeError ( where : string, exception : Error ) {
	writeLine (
		'Error in ' + where,
		'failure'
	);

	if ( exception instanceof SyntaxError ) {
		writeLine (
			'line: ' + exception ['lineNumber'] + ', ' +
			'column: ' + exception ['column'],
			'failure'
		);
	}

	writeLine (
		exception ['stack'],
		'failure'
	);

	numErrors++;
	numErrorsElt.innerText = numErrors + '';
	numErrorsElt.className = 'failure';
}

// DEBUG: used in loc comparison.
var currentCode : string;

function processFile () {
	if ( fileIdx >= zipEntries.length )
		return;

	var zipEntry = zipEntries [fileIdx++],
		filePath = zipEntry.filename;

	currentFileElt.innerText = filePath;

	zipEntry.getData ( new zip.TextWriter (), function ( code ) {
		try {
			var esprimaAst : any = null,
				myAst : any = null,
				timeStart = Date.now ();

			currentCode = code;	// DEBUG: loc comparison.

			try {
				esprimaAst = esParser.parse ( code, { loc : true } );
			} catch ( ex ) {
				writeLine ( filePath + ':' );
				writeError ( 'esprima.parse ()', ex );
			}

			var parseTime = ( Date.now () - timeStart ) / 1000;
			timeElapsed += parseTime;
			timeStart = Date.now ();

			try {
				var parseRes = myParser.parse ( code ),
				myAst = parseRes.ast;
			} catch ( ex ) {
				writeLine ( filePath + ':' );
				writeError ( 'myParser.parse ()', ex );
			}

			parseTime = ( Date.now () - timeStart ) / 1000;
			timeElapsed += parseTime;
			myParserTimeElapsed += parseTime;
			var numLines = code.split ( /[\n\u2028\u2029]|\r\n?/ ).length;
			numNodes = 0;

			if ( esprimaAst && myAst ) {
				var success = compareNodes ( esprimaAst, myAst ),
					printComparisonResults = !success || printSuccessfulComparisons;

				if ( printComparisonResults ) {
					writeLine ( filePath + ':' );

					if ( success )
						write ( 'identical', 'success' );
					else
						write ( 'different', 'failure' );

					writeLine (
						' ast, numNodes: ' + numNodes +
						', numLines: ' + numLines +
						', size: ' + ( code.length / ( 2 << 10 ) ).toFixed ( 2 ) + ' Kbytes'
					);
				}

				if ( !success ) {
					numDifferencesElt.innerText = ++numDifferences + '';
					numDifferencesElt.className = 'failure';
				}
			}

			totalNumNodes += numNodes;
			totalNumLines += numLines;
			totalSizeInBytes += code.length;

			totalNumNodesElt.innerText = totalNumNodes + '';
			totalNumLinesElt.innerText = totalNumLines + '';
			totalSizeElt.innerText = ( totalSizeInBytes / ( 2 << 20 ) ).toFixed ( 2 ) + 'Mb';
			myParserKbytesPerSecElt.innerText = ( totalSizeInBytes / ( 2 << 10 ) / myParserTimeElapsed ).toFixed ( 2 ) + 'Kb/sec';
			timeElapsedElt.innerText = timeElapsed.toFixed ( 2 ) + ' sec';
			progressElt.innerText =
				( fileIdx * 100 / zipEntries.length ).toFixed ( 2 ) + '%' +
				' (' + fileIdx + '/' + zipEntries.length + ')';
		} catch ( ex ) {
			writeLine ( filePath + ':' );
			writeError ( 'processFile ()', ex );
		} finally {
			processFile ();
		}
	}, function ( current : number, total : number ) {
		currentFileElt.innerText = filePath;
		var progress = current * 100 / total;

		if ( progress !== 100 )
			currentFileElt.innerText += ' ' + progress.toFixed ( 2 ) + '%';
	} );
}

function compareNodes ( node1 : any, node2 : any, silent = false ) {
	if ( node1.type === 'ArrayExpression' &&
		 node2.type === 'ArrayExpression' )
	{
		delete node1.lastElided;
		delete node2.lastElided;
	} else if ( node1.type === 'UnaryExpression' &&
				node2.type === 'UnaryExpression' )
	{
		delete node1.prefix;
		delete node2.prefix;
	} else if ( node1.type === 'CatchClause' &&
				node2.type === 'CatchClause' )
	{
		delete node1.guard;
		delete node2.guard;
	} else if ( node1.type === 'SwitchStatement' &&
				node2.type === 'SwitchStatement' )
	{
		delete node1.lexical;
		delete node2.lexical;
	}
	
	delete node1.raw;
	delete node2.raw;

	if ( Array.isArray ( node1 ) && Array.isArray ( node2 ) ) {
		removeEmptyStatements ( node1 );
		removeEmptyStatements ( node2 );
	}

	if ( 'type' in node1 )
		numNodes++;

	var keys1 = Object.keys ( node1 ),
		keys2 = Object.keys ( node2 );

	if ( keys1.length !== keys2.length ) {
		if ( !silent )
			writeLine ( 'different number of keys: ' + keys1.length + ' and ' + keys2.length );

		return	false;
	}

	keys1.sort ();
	keys2.sort ();

	for ( var i = 0 ; i < keys1.length ; i++ ) {
		var key1 = keys1 [i],
			key2 = keys2 [i];

		if ( key1 !== key2 ) {
			if ( !silent )
				writeLine ( 'different keys: "' + key1 + '" and "' + key2 + '"', 'failure' );

			return	false;
		}

		var val1 = node1 [key1],
			val2 = node2 [key2];

		if ( typeof val1 !== typeof val2 ) {
			if ( !silent ) {
				writeLine (
					'different types, key: "' + key1 + '", ' +
					'type1: "' + typeof val1 + '", ' +
					'type2: "' + typeof val2 + '"',
					'failure'
				);
			}

			return	false;
		}

		if ( key1 === 'expression' && node1.type === 'FunctionExpression' ) {
			val1 = val2 = true;
		}

		if ( typeof val1 === 'object' && val1 != null && val2 != null ) {
			var isLoc = false;

			if ( key1 === 'loc' ) {
				// DEBUG
				//continue;

				cleanLoc ( val1 );
				cleanLoc ( val2 );
				isLoc = true;
			}

			if ( !compareNodes ( val1, val2, isLoc || silent ) ) {
				if ( isLoc ) {
					var loc1 = <SourceLocation> val1,
						loc2 = <SourceLocation> val2,
						code1 = substrByLoc ( currentCode, loc1 ),
						code2 = substrByLoc ( currentCode, loc2 ),
						code1_orig = code1, code2_orig = code2;

					if ( loc1.start.line === loc2.start.line &&
						 loc1.start.column === loc2.start.column
					) {
						/* My parser and esprima might disagree about statement end
						 * when it is not finished with semicolon and automatic semicolon
						 * insertion has been occured. */
						if ( code1.length > code2.length ) {
							var t = code1;
							code1 = code2;
							code2 = t;
						}

						/* Check that code1 and code2 differs only by trailing
						 * whitespace/newline characters as well as single/multi-line comments.
						 * Also Esprima provides wrong results in cases such as 'var a\n;',
						 * its production is VariableDeclaration and EmptyStatement despite
						 * that semicolon character is just a part of variable declaration. */
						var diff = code2.substr ( code1.length );
						
						if ( /^(?:\s|\/\/[^\n]*|\/\*(?:.|\s)*\*\/)*;?$/.test ( diff ) )
							return	true;
					} else if ( loc1.end.line === loc2.end.line &&
								loc1.end.column === loc2.end.column &&
								node1.type === 'FunctionExpression'
					) {
						/* My parser and esprima might disagree about function expression start.
						 * Given the code '({get v () {}})' esprima thinks that location of
						 * function expression coincides with its body, i.e. '({get v () |{}|})'.
						 * My parser has another opinion, it considers argument list as part of
						 * function expression, so its vision is: '({get v |() {}|})' */
						if ( code1.length > code2.length ) {
							var t = code1;
							code1 = code2;
							code2 = t;
						}

						/* Check that code1 and code2 differs only by argument list
						 * in the beginning. */
						var diff = code2.substr ( 0, code2.length - code1.length );

						if ( /^\([^)]*\)\s*$/.test ( diff ) )
							return	true;
					}

					debugger;	// Inspect difference manually.
				}

				return	false;
			}
		} else if ( val1 !== val2 ) {
			if ( !silent ) {
				writeLine (
					'different values, key: "' + key1 + '", ' +
					'value1: "' + val1 + '", ' +
					'value2: "' + val2 + '"',
					'failure'
				);
			}

			return	false;
		}
	}

	return	true;
}

function cleanLoc ( loc : SourceLocation ) {
	delete loc.source;
	delete loc.start.index;
	delete loc.end.index;
}

function substrByLoc ( code : string, loc : SourceLocation ) {
	var lines = code.split ( /[\n\u2028\u2029]|\r\n?/ ),
		startLine = loc.start.line - 1,
		endLine = loc.end.line - 1,
		str = '';

	for ( var i = startLine ; i <= endLine ; i++ ) {
		var line = lines [i],
			s = i === startLine ? loc.start.column : 0,
			e = i === endLine ? loc.end.column : line.length;

		str += line.substring ( s, e );
	}

	return	str;
}

function removeEmptyStatements ( statements : any [] ) {
	/* esprima produces unnecessary empty statement in code 'var a = 5\n;',
	 * so compare in empty-statement-agnostic manner. */
	for ( var i = statements.length - 1 ; i >= 0 ; i-- ) {
		var node = statements [i];

		if ( node != null && node.type === 'EmptyStatement' )
			statements.splice ( i, 1 );
	}
}