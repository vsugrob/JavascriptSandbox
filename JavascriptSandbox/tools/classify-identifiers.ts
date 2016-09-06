var keywords : string [] = [
	'break', 'do', 'instanceof', 'typeof', 'case',
	'else', 'new', 'var', 'catch', 'finally', 'return',
	'void', 'continue', 'for', 'switch', 'while', 'debugger',
	'function', 'this', 'with', 'default', 'if', 'throw',
	'delete', 'in', 'try',
];

var futureReservedWords : string [] = [
	'class', 'enum', 'extends', 'super',
	'const', 'export', 'import',
];

var strictFutureReservedWords : string [] = [
	'implements', 'let', 'private', 'public', 'yield',
	'interface', 'package', 'protected', 'static',
];

var nullWord : string [] = ['null'];
var booleanWords : string [] = ['true', 'false'];

var reservedWords = keywords
	.concat ( futureReservedWords )
	.concat ( strictFutureReservedWords )
	.concat ( nullWord )
	.concat ( booleanWords );

reservedWords.sort ();

window.onload = function () {
	var d = document,
		eResults = d.getElementById ( 'results' );

	// TODO: I don't think this is necessary.
	function writeFirstCc ( fieldName : string, word : string ) {
		eResults.innerHTML += 'public static ' + fieldName +
			' = 0x' + word.charCodeAt ( 0 ).toString ( 16 ) + ';\t// ' + word [0] + '\n';
	}
	
	eResults.innerHTML = '// This was generated with tools/classify-identifiers.html\n';
	// TODO: I don't think this is necessary.
	//writeFirstCc ( 'minReservedCc', reservedWords [0] );
	//writeFirstCc ( 'maxReservedCc', reservedWords [reservedWords.length - 1] );
	eResults.innerHTML += 'public static idKindMap = &lt;IdKindMap&gt; System.toFrozenMap ( {\n';

	for ( var i = 0 ; i < reservedWords.length ; i++ ) {
		var word = reservedWords [i],
			kind : string;

		if ( -1 !== keywords.indexOf ( word ) )
			kind = 'IdentifierKind.Keyword';
		else if ( -1 !== futureReservedWords.indexOf ( word ) )
			kind = 'IdentifierKind.FutureReservedWord';
		else if ( -1 !== strictFutureReservedWords.indexOf ( word ) )
			kind = 'IdentifierKind.StrictFutureReservedWord';
		else if ( -1 !== nullWord.indexOf ( word ) )
			kind = 'IdentifierKind.NullLiteral';
		else /*if ( -1 !== booleanWords.indexOf ( word ) )*/
			kind = 'IdentifierKind.BooleanLiteral';

		eResults.innerHTML += "\t'" + word + "' : { value : " + kind + ' },\n'
	}

	eResults.innerHTML += '} );\n';
};