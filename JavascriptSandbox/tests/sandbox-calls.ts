/// <reference path="../Ast.ts" />
window.onload = function () {
	var d = document,
		esprima = window ['esprima'],
		xhr = new XMLHttpRequest ();

	xhr.open ( 'get', '../sandbox-core.js', false );
	xhr.send ();

	var code = xhr.responseText,
		ast = esprima.parse ( code, { range : true, loc : true } ),
		eCalls = d.getElementById ( 'calls' ),
		numCalls = 0,
		lenLimit = 50,
		beginningLen = 25,
		endingLen = lenLimit - beginningLen;

	Ast.walk ( ast, function ( node : EsAstNode ) {
		if ( node.type === Ast.S.CallExpression || node.type === Ast.S.NewExpression ) {
			var loc = node.loc.start,
				si = node.range [0],
				ei = node.range [1],
				callCode : string;

			if ( ei - si > lenLimit ) {
				callCode = code.substr ( si, beginningLen ) + ' ... ' + code.substring ( ei - endingLen, ei );
			} else {
				callCode = code.substring ( si, ei );
			}

			var eCall = d.createElement ( 'p' );
			eCall.className = 'call';
			var eLoc = d.createElement ( 'span' );
			eLoc.className = 'loc';
			eLoc.innerText = '#' + ( ++numCalls ) + ':' + loc.line + ':' + ( loc.column + 1 );
			var eCode = d.createElement ( 'code' );
			eCode.innerText = callCode;

			eCall.appendChild ( eLoc );
			eCall.appendChild ( eCode );
			eCalls.appendChild ( eCall );
		}

		return	false;
	} );
}