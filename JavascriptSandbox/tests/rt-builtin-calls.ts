/// <reference path="../Ast.ts" />

function pushUnique ( arr : any [], value : any ) {
	if ( -1 === arr.indexOf ( value ) ) {
		arr.push ( value );

		return	true;
	}

	return	false;
}

function walkObject ( parent : any, id : string, predicate : ( o : any, id : string, fullId : string [] ) => boolean,
	ancestors? : any [], path? : string [] )
{
	var o : any;

	try {
		o = parent [id];
	} catch ( ex ) {
		return;
	}

	var fullId = path ? path.concat ( [id] ) : [id],
		diveIn = predicate ( o, id, fullId );

	if ( diveIn ) {
		if ( !Array.isArray ( ancestors ) )
			ancestors = [];

		if ( -1 !== ancestors.indexOf ( o ) )
			return;

		ancestors = ancestors.concat ( [o] );
		path = fullId;

		while ( o != null && typeof o === 'object' || typeof o === 'function' ) {
			var props = Object.getOwnPropertyNames ( o );

			for ( var i = 0 ; i < props.length ; i++ ) {
				var p = props [i];
				walkObject ( o, p, predicate, ancestors, path );
			}

 			o = Object.getPrototypeOf ( o );
		}
	}
}

function isRuntimeBuiltin ( memberExpr : any ) {
	return	memberExpr.object.type === Ast.S.Identifier && memberExpr.object.name === 'Runtime' &&
			memberExpr.property.type === Ast.S.Identifier && memberExpr.property.name === 'builtin';
}

function getCodeExcerpt ( code : string, rangeStart : number, rangeEnd : number, subjClassName : string, numContextLines = 1 ) {
	var s = seekNLines ( code, rangeStart, -1, -1, numContextLines ),
		e = seekNLines ( code, rangeStart, code.length, 1, numContextLines ),
		l = e - s,
		code = code.substr ( s, e - s );

	rangeStart -= s;
	rangeEnd -= s;
	rangeEnd = Math.min ( rangeEnd, l );

	var eCode = document.createElement ( 'span' ),
		ePre = document.createElement ( 'span' ),
		eSubj = document.createElement ( 'span' ),
		ePost = document.createElement ( 'span' );

	eCode.className = 'code';
	ePre.innerText = code.substr ( 0, rangeStart );
	eSubj.innerText = code.substr ( rangeStart, rangeEnd - rangeStart );
	eSubj.className = subjClassName;
	ePost.innerText = code.substr ( rangeEnd, l );

	eCode.appendChild ( ePre );
	eCode.appendChild ( eSubj );
	eCode.appendChild ( ePost );

	return	eCode;
}

function seekNLines ( code : string, start : number, end : number, step : number, numLines : number ) {
	var numNewLines = 0, i;

	for ( i = start ; i != end ; i += step ) {
		var c = code [i];

		if ( c === '\n' ) {
			numNewLines++;

			if ( numNewLines > numLines )
				break;
		}
	}

	return	i;
}

function appendExaminedItem ( eFile : HTMLElement, loc : any, itemIdx : number, examinedCode : string );
function appendExaminedItem ( eFile : HTMLElement, loc : any, itemIdx : number, examinedCode : HTMLElement );
function appendExaminedItem ( eFile : HTMLElement, loc : any, itemIdx : number, examinedCode : any ) {
	var eCall = document.createElement ( 'p' );
	eCall.className = 'examined-item';
	var eLoc = document.createElement ( 'span' );
	eLoc.className = 'loc';
	eLoc.innerText = '#' + ( itemIdx ) + ':' + loc.line + ':' + ( loc.column + 1 );

	var eCode : HTMLElement;

	if ( typeof examinedCode === 'string' ) {
		eCode = document.createElement ( 'span' );
		eCode.className = 'code';
		eCode.innerText = examinedCode;
	} else
		eCode = <HTMLElement> examinedCode;

	eCall.appendChild ( eLoc );
	eCall.appendChild ( eCode );
	eFile.appendChild ( eCall );
}


window.onload = function () {
	var d = document,
		global = window,
		esprima = window ['esprima'],
		xhr = new XMLHttpRequest (),
		eCalls = d.getElementById ( 'calls' ),
		eBuiltinCallables = d.getElementById ( 'builtin-callables' );

	// Taken from https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects#Standard_global_objects_(alphabetically)
	var builtinIds = [
		'Array', 'ArrayBuffer', 'Boolean', 'Collator', 'DataView', 'Date',
		'DateTimeFormat', 'decodeURI', 'decodeURIComponent', 'encodeURI',
		'encodeURIComponent', 'Error', 'eval', 'EvalError', 'Float32Array',
		'Float64Array', 'Function', 'Infinity', 'Intl', 'Int16Array', 'Int32Array',
		'Int8Array', 'isFinite', 'isNaN', 'Iterator', 'JSON', 'Math', 'NaN',
		'Number', 'NumberFormat', 'Object', 'parseFloat', 'parseInt', 'RangeError',
		'ReferenceError', 'RegExp', 'StopIteration', 'String', 'SyntaxError', 'TypeError',
		'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'undefined',
		'uneval', 'URIError'
	];

	var inspectedObjects : Function [] = [],
		builtinCallableNames : string [] = [];

	for ( var i = 0 ; i < builtinIds.length ; i++ ) {
		var id = builtinIds [i];

		if ( id in global ) {
			walkObject ( global, id, function ( o : any, id : string, fullId : string [] ) {
				if ( typeof o === 'function' )
					pushUnique ( builtinCallableNames, id );

				return	pushUnique ( inspectedObjects, o );
			} );
		}
	}

	builtinCallableNames.sort ();

	for ( var i = 0 ; i < builtinCallableNames.length ; i++ ) {
		var callableId = builtinCallableNames [i],
			eCallable = d.createElement ( 'span' );

		eCallable.className = 'builtin-callable';
		eCallable.innerText = i + ': ' + callableId;
		eBuiltinCallables.appendChild ( eCallable );
	}

	eBuiltinCallables.className = 'element-minimized';
	eBuiltinCallables.addEventListener ( 'click', function () {
		eBuiltinCallables.classList.toggle ( 'element-minimized' );
	}, false );

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

	//fileNames = ['../sandbox-core.js']; // DEBUG

	var usedBuiltinCalls : string [] = [];
	
	for ( var i = 0 ; i < fileNames.length ; i++ ) {
		var fileName = fileNames [i];
		xhr.open ( 'get', fileName, false );
		xhr.send ();

		var code = xhr.responseText,
			ast = esprima.parse ( code, { range : true, loc : true } ),
			numItems = 0;

		var eFile = d.createElement ( 'div' );
		eFile.className = 'file';
		var eFileIdx = d.createElement ( 'span' );
		eFileIdx.innerText = i + ': ';
		var eFileInfo = d.createElement ( 'span' );
		eFileInfo.className = 'file-info';
		eFileInfo.innerText = fileName;
		eFile.appendChild ( eFileIdx );
		eFile.appendChild ( eFileInfo );
		eCalls.appendChild ( eFile );

		Ast.walk ( ast, function ( node : EsAstNode, path : any [] ) {
			if ( path.length > 24 &&	// Approximate depth where generated code ends.
				node.type === Ast.S.CallExpression || node.type === Ast.S.NewExpression )
			{
				var callee = node ['callee'],
					calleeId : string;

				if ( callee.type === Ast.S.Identifier )
					calleeId = callee.name;
				else if ( callee.type === Ast.S.MemberExpression ) {
					var objectNode = callee.object;

					// Filter safe calls.
					if ( callee.property.type === Ast.S.Identifier &&
						( callee.property.name === 'call' ||
						  callee.property.name === 'apply' ) )
					{
						return	false;
					} else if ( objectNode.type === Ast.S.MemberExpression ) {
						if ( isRuntimeBuiltin ( objectNode ) )	// Filter calls like Runtime.builtin.keys ( o )
							return	false;
						else if ( objectNode.object.type === Ast.S.MemberExpression && isRuntimeBuiltin ( objectNode.object ) ) {
							// Filter calls like Runtime.builtin.push.call ( this.body, rstNode )
							return	false;
						}
					}

					var propNode = callee.property;

					if ( propNode.type === Ast.S.Identifier )
						calleeId = propNode.name;
					else if ( propNode.type === Ast.S.Literal )
						calleeId = propNode.value + '';
					else
						return	false;
				} else
					return	false;

				if ( -1 === builtinCallableNames.indexOf ( calleeId ) )
					return	false;
				
				if ( -1 === usedBuiltinCalls.indexOf ( calleeId ) )
					usedBuiltinCalls.push ( calleeId );

				var eCallCode = getCodeExcerpt ( code, node.range [0], node.range [1], 'call-code' );
				
				appendExaminedItem ( eFile, node.loc.start, ++numItems, eCallCode );
			} else if (
				path.length > 25 &&	// Approximate depth where generated properties ends.
				node.type === Ast.S.ObjectExpression
			) {
				var eObjCode = getCodeExcerpt ( code, node.range [0], node.range [1], 'object-code' );
				appendExaminedItem ( eFile, node.loc.start, ++numItems, eObjCode );
			} else if (
				path.length > 19 &&	// Approximate depth where generated enum code ends.
				node.type === Ast.S.ArrayExpression
			) {
				var eArrCode = getCodeExcerpt ( code, node.range [0], node.range [1], 'array-code' );
				appendExaminedItem ( eFile, node.loc.start, ++numItems, eArrCode );
			} else if (
				false &&
				node.type === Ast.S.MemberExpression && node ['computed']
			) {
				var objectNode = node ['object'];

				if ( objectNode.type === Ast.S.MemberExpression &&
					 objectNode.object.name === 'runtime' && objectNode.property.name === 'registers' )
				{
					return	false;
				}

				var eMemberExprCode = getCodeExcerpt ( code, node.range [0], node.range [1], 'member-expr-code' );
				appendExaminedItem ( eFile, node.loc.start, ++numItems, eMemberExprCode );
			}

			return	false;
		} );
	}

	var eUsedBuiltinCallables = d.getElementById ( 'used-builtin-callables' );
	usedBuiltinCalls.sort ();

	for ( var i = 0 ; i < usedBuiltinCalls.length ; i++ ) {
		var callableId = usedBuiltinCalls [i],
			eCallable = d.createElement ( 'span' );

		eCallable.className = 'builtin-callable';
		eCallable.innerText = i + ': ' + callableId;
		eUsedBuiltinCallables.appendChild ( eCallable );
	}
}