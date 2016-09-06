/// <reference path="../Ast.ts" />

window.onload = function () {
	var d = document,
		global = window,
		esprima = window ['esprima'],
		xhr = new XMLHttpRequest (),
		eCalls = d.getElementById ( 'calls' ),
		eBuiltinCallables = d.getElementById ( 'builtin-callables' );

	var fileNames = [
			'ArrayExpression', 'AssignmentExpression', 'BinaryExpression', 'BlockStatement',
			'BreakStatement', 'CallExpression', 'CatchClause', 'ConditionalExpression', 'ContinueStatement',
			'DoWhileStatement', 'EmptyStatement', 'ExpressionStatement', 'ForStatement', 'ForInStatement',
			'FunctionExpression', 'FunctionDeclaration', 'Identifier', 'IfStatement', 'LabeledStatement', 'Literal',
			'LogicalExpression', 'MemberExpression', 'NewExpression', 'ObjectExpression', 'Program', 'Property',
			'ReturnStatement', 'SequenceExpression', 'SwitchStatement', 'SwitchCase', 'ThisExpression', 'ThrowStatement',
			'TryStatement', 'UnaryExpression', 'UpdateExpression', 'VariableDeclaration', 'VariableDeclarator',
			'WhileStatement', 'WithStatement'
		]
		.concat ( ['RstNode', 'InvocationNode', 'FunctionNode', 'ScopeNode'] )
		.map ( fileName => '../rst/' + fileName + '.js' )
		.concat ( ['../Runtime.js'] );

	var tokenRates = {},
		punctuatorRates = {},
		idCaseRates = {
			'LowerCaseId' : 0,
			'UpperCaseId' : 0
		},
		keywordRates = {};

	for ( var i = 0 ; i < fileNames.length ; i++ ) {
		var fileName = fileNames [i];
		xhr.open ( 'get', fileName, false );
		xhr.send ();

		var code = xhr.responseText,
			ast = esprima.parse ( code, { range : true, loc : true, tokens : true } ),
			numItems = 0;

		for ( var j = 0 ; j < ast.tokens.length ; j++ ) {
			var token = ast.tokens [j];

			if ( token.type in tokenRates )
				tokenRates [token.type]++;
			else
				tokenRates [token.type] = 1;

			if ( token.type === 'Punctuator' ) {
				if ( token.value in punctuatorRates )
					punctuatorRates [token.value]++;
				else
					punctuatorRates [token.value] = 1;
			}

			if ( token.type === 'Keyword' ||
				 token.type === 'Null' ||
				 token.type === 'Boolean' )
			{
				if ( token.value in keywordRates )
					keywordRates [token.value]++;
				else
					keywordRates [token.value] = 1;
			}

			if ( token.type === 'Keyword' ||
				 token.type === 'Identifier' ||
				 token.type === 'Null' ||
				 token.type === 'Boolean' )
			{
				var firstChar : string = token.value [0],
					isLc = firstChar.toLowerCase () === firstChar;

				if ( isLc )
					idCaseRates.LowerCaseId++;
				else
					idCaseRates.UpperCaseId++;
			}
		}
	}

	tokenRates ['[Id-like]'] = tokenRates ['Keyword'] + tokenRates ['Identifier'] + tokenRates ['Null'] + tokenRates ['Boolean'];
	
	var report = '';
	report += toReportString ( tokenRates, 'Token type rates' );
	report += toReportString ( idCaseRates, 'Identifier case rates' );
	report += toReportString ( keywordRates, 'Keyword rates' );
	report += toReportString ( punctuatorRates, 'Punctuator value rates' );

	var punctuatorFirstCharRates = {};

	for ( var k in punctuatorRates ) {
		var firstChar : string = k [0];
		firstChar += ' 0x' + firstChar.charCodeAt ( 0 ).toString ( 16 );

		if ( firstChar in punctuatorFirstCharRates )
			punctuatorFirstCharRates [firstChar] += punctuatorRates [k];
		else
			punctuatorFirstCharRates [firstChar] = punctuatorRates [k];
	}

	var summaryRates = merge ( tokenRates, idCaseRates, punctuatorFirstCharRates );
	delete summaryRates ['Punctuator'];
	delete summaryRates ['[Id-like]'];
	delete summaryRates ['Identifier'];
	delete summaryRates ['Keyword'];
	delete summaryRates ['Boolean'];
	delete summaryRates ['Null'];
	
	report += toReportString ( summaryRates, 'Summary rates' );
	
	var eResults = d.getElementById ( 'results' );
	eResults.innerText = report;
}

function toReportString ( ratesDictionary : any, title : string ) {
	ratesDictionary = toSortedDictionary ( ratesDictionary );
	var totalMatches = 0;

	for ( var name in ratesDictionary ) {
		totalMatches += ratesDictionary [name];
	}

	var report = title + ':\n';
	
	for ( var name in ratesDictionary ) {
		var numMatches = ratesDictionary [name];

		report += name + ' ' +
			numMatches + ' ' +
			( numMatches * 100 / totalMatches ).toFixed ( 2 ) + '%' +
		'\n';
	}

	report += '\n';

	return	report;
}

function toSortedDictionary ( ratesDictionary : any ) {
	var ratesArr = [];

	for ( var k in ratesDictionary ) {
		ratesArr.push ( {
			name : k,
			value : ratesDictionary [k]
		} );
	}

	ratesArr.sort ( ( a, b ) => {
		if ( a.value > b.value )
			return	1;
		else if ( a.value < b.value )
			return	-1;
		else
			return	0;
	} );

	ratesArr = ratesArr.reverse ();
	ratesDictionary = {};

	for ( var i = 0 ; i < ratesArr.length ; i++ ) {
		var rateEntry = ratesArr [i];
		ratesDictionary [rateEntry.name] = rateEntry.value;
	}

	return	ratesDictionary;
}

function merge ( ...objects : any [] ) {
	var r = {};

	for ( var i = 0 ; i < objects.length ; i++ ) {
		var srcObj = objects [i];

		for ( var k in srcObj ) {
			r [k] = srcObj [k];
		}
	}

	return	r;
}