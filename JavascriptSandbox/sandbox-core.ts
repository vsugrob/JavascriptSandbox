/// <reference path="sandbox-defs.ts" />
/* TODO: substitute Object.defineProperty to custom method
 * which always sets enumerable = true and configurable = true?
 * Otherwise it is possible to redefine some prototypes from guest
 * so that we cannot restore them.
 * Also investigate Object.freeze, Object.preventExtensions, Object.seal.
 * DONE: now we use stored functions so guest code can redefine standard
 * objects/methods in any possible way without interferring with sandbox.
 */
/* TODO: arguments.callee.caller and Function.caller may provide means
 * for jailbreak.
 * DONE: strict mode prohibits their use. */
/* TODO: study with statement - https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Statements/with
 * DONE: strict mode prohibits use of 'with' statement. */
/* TODO: it seems __proto__ can be used to redefine whole prototype chain for any object in some engines.
 * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/GetPrototypeOf#Notes
 */
/* TODO: redefine call and apply so that when they called with thisArg set to null, context swapped from real
 * global to guest global. UPD: it seems that context is not swapped to global in strict mode. It is null instead
 * and it's ok.
 * DONE: strict mode fixes it. */
/* TODO: make all types, and their members completely deterministic.
 * For example: myfunc.toString () being called in Chrome returns string representation of function code
 * where newline characters replaced with spaces. But in IE newlines kept untouched.
 * Some types enumerates different list of members, meanwhile these lists must contain same elements with the same
 * order of enumeration.
 * Error and its inheritors exposes different members in different browsers. */
/* TODO: RegExp type is non-deterministic. Forbid this type and make some safe wrapper
 * if RegExp is really needed for guest scripts.
 * Alternatively it can be reset by something like 'reset'.match ( /reset/ );
 */
/* TODO: exception descriptions vary from browser to browser. */
/* TODO: rename to sandbox-server.ts. Also rename sandbox.ts to sandbox-client.ts.
 * Rename Sandbox class to SandboxClient. */
/* TODO: evaluate undefToughGlobalsCode in global context of worker.
 * This will strenghten tier 1 sandbox isolation. */
/* TODO: Chrome defines vars as non-configurable on current scope while IE/FF makes them configurable.
 * var hehe = 14;
 * Object.getOwnPropertyDescriptor ( this, 'hehe' ) -> configurable : false(Chrome)/true(IE/FF).
 * Thus when we execute delete this.hehe, Chrome refuses to do so, whereas IE/FF deletes variable.
 * UPD: IE/FF has this behavior only on global object. */
/* TODO: enforce "use strict"; I guess there is no reason on sticking to non-strict mode since
 * guest code has no access to global object and all global variables could be redefined. */
interface IOutArg {
	value : any;
}

( function () {
	var global = this,
	postMessage = <( message : any, ports? : any ) => void> global.postMessage,
	getOwnPropertyNames = Object.getOwnPropertyNames,
	getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
	hasOwnProperty = Object.prototype.hasOwnProperty,
	getPrototypeOf = Object.getPrototypeOf,
	defineProperty = Object.defineProperty,
	freeze = Object.freeze,
	toString = Object.prototype.toString,
	slice = Array.prototype.slice,
	push = Array.prototype.push,
	indexOf = Array.prototype.indexOf,
	concat = Array.prototype.concat,
	sort = Array.prototype.sort,
	isArray = Array.isArray,
	match = String.prototype.match,
	substr = String.prototype.substr,
	substring = String.prototype.substring,
	FunctionCtor = Function,
	bind = Function.prototype.bind,
	TypeError = global.TypeError,
	ceil = <( x : number ) => number> Math.ceil.bind ( Math ),
	isFinite = <( number : number ) => bool> global.isFinite,
	isNaN = <( number : number ) => bool> global.isNaN,
	isInt = function ( value : number ) { return	typeof value === 'number' && isFinite ( value ) && value === ceil ( value ); },
	setInterval = <( expression : any, msec? : number, language? : any ) => number> global.setInterval,
	clearInterval = <( handle : number ) => void> global.clearInterval,
	allowedIdentifiers = [
		'Array', 'Object', 'Boolean', 'Number', 'String', 'RegExp', 'Math',
		'NaN', 'isNaN', 'Infinity', 'isFinite', 'parseInt', 'parseFloat',
		'Error'/*, 'EvalError'*/, 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError'/*, 'URIError'*/
	],
	guestGlobalIds : ParsedIdentifier [] = [],
	guestScope = Object.create ( null ),
	tailExprValue = undefined,
	undefToughGlobalsCode = '',
	saveGuestGlobalsCode = '',
	restoreGuestGlobalsCode = '',
	outputNotificationsEnabled = false,	// Guest dir and log notifications.
	addGuestGlobalIds = function ( globalIds : ParsedIdentifier [] ) {
		for ( var i = 0 ; i < globalIds.length ; i++ ) {
			var id = globalIds [i],
				found = false;
			
			for ( var j = 0 ; j < guestGlobalIds.length ; j++ ) {
				if ( id.name === guestGlobalIds [j].name ) {
					found = true;
					break;
				}
			}

			if ( !found )
				push.call ( guestGlobalIds, id );
		}

		saveGuestGlobalsCode = '';
		restoreGuestGlobalsCode = '';
		
		for ( var i = 0 ; i < guestGlobalIds.length ; i++ ) {
			var id = guestGlobalIds [i];

			saveGuestGlobalsCode += 'this["' + id.name + '"]=' + id.name + ';';
			restoreGuestGlobalsCode += 'var ' + id.name + '=this["' + id.name + '"]';

			if ( id.type === 'function' )
				restoreGuestGlobalsCode += '||' + id.name;

			restoreGuestGlobalsCode += ';';
		}
	},
	exceptionFreeToString = function ( o : any, success? : IOutArg ) {
		var str : string,
			outEnabled = outputNotificationsEnabled;

		outputNotificationsEnabled = false;

		try {
			str = o + '';

			if ( typeof success === 'object' && success !== null )
				success.value = true;
		} catch ( ex ) {
			if ( typeof success === 'object' && success !== null )
				success.value = false;

			try {
				str = 'Error calling toString (): ' + ex + '';
			} catch ( ex ) {
				str = 'Error occured while trying to get string representation object.' +
					  ' Another error occured while trying to get error description.';
			}
		} finally {
			outputNotificationsEnabled = outEnabled;
		}

		return	str;
	},
	checkHasCustomStringRepr = function ( o : any ) {
		if ( o == null || typeof o === 'number' || typeof o === 'string' || typeof o === 'boolean' )
			return	true;

		var found = false,
			deepEnough = false;

		try {
			do {
				if ( !found )
					found = hasOwnProperty.call ( o, 'toString' );
				else
					deepEnough = true;
			} while ( !deepEnough && null !== ( o = getPrototypeOf ( o ) ) );
		} catch ( ex ) {
			return	false;
		}

		return	deepEnough;
	},
	distinct = function ( arr : any [] ) {
		var dArr = [];

		for ( var i = 0 ; i < arr.length ; i++ ) {
			var e = arr [i];

			if ( -1 === indexOf.call ( dArr, e ) )
				push.call ( dArr, e );
		}

		return	dArr;
	},
	reflectType = function ( o : any ) : ReflectedType {
		var classType = toString.call ( o );	// [[Class]] internal property value.
		classType = substring.call ( classType, 8, classType.length - 1 );

		var specificType : string = null,
			ctor = null;

		/* TODO: read constructor of the proto! o.constructor can be overriden.
		 * UPD: However proto.constructor might be overriden too... */
		if ( classType === 'Function' )
			ctor = o;
		else if ( o != null && typeof o ['constructor'] === 'function' )
			ctor = o ['constructor'];
		
		if ( ctor !== null ) {
			var m = match.call ( ctor + '', /function\s+([^\s(]+)/ );

			if ( m !== null && m [1] !== undefined )
				specificType = m [1];
		}

		if ( specificType === null )
			specificType = classType;

		return	{
			classType : classType,
			specificType : specificType
		};
	},
	reflectValue = function ( o : any, name : string, oPath : string [],
		parentProperty : ReflectedProperty = null, outPropValue? : IOutArg ) : ReflectedValue
	{
		var value : any,
			strValue : string,
			getValueSuccess = true;

		oPath = concat.call ( oPath, [name] );

		try {
			if ( name === null )
				value = getPrototypeOf ( o );
			else
				value = o [name];

			if ( typeof outPropValue === 'object' && outPropValue !== null )
				outPropValue.value = value;
		} catch ( ex ) {
			getValueSuccess = false;
			strValue = exceptionFreeToString ( ex );
		}

		var hasCustomStringRepr = false,
			reflectedType : ReflectedType = null,
			objectHasProperties = false;

		if ( getValueSuccess ) {
			reflectedType = reflectType ( value );
			objectHasProperties = checkObjectHasProperties ( value );

			var outToStringSuccess : IOutArg = { value : undefined };
			strValue = exceptionFreeToString ( value, outToStringSuccess );

			if ( outToStringSuccess.value )
				hasCustomStringRepr = checkHasCustomStringRepr ( value );
		}

		return	{
			parentProperty : parentProperty,
			value : strValue,
			success : getValueSuccess,
			hasCustomStringRepr : hasCustomStringRepr,
			type : reflectedType,
			path : oPath,
			hasProperties : objectHasProperties,
			properties : []
		};
	},
	reflectOwnProperties = function ( o : any, oPath : string [],
		parentValue : ReflectedValue, reflectProto = true, setOwnFlag = true )
	{
		var props : ReflectedProperty [] = [],
			prop : ReflectedProperty;

		if ( reflectProto ) {
			var hasProto = false;

			try {
				hasProto = getPrototypeOf ( o ) !== null;
			} catch ( ex ) { hasProto = false; }

			if ( hasProto ) {
				prop = {
					parentValue : parentValue,
					name : null,
					attributes : '',
					value : null
				};

				prop.value = reflectValue ( o, null, oPath, prop );
				push.call ( props, prop );
			}
		}

		var ownPropNames : string [];

		try {
			// NOTE: IE 10 return duplicates for some objects (i.e. RegExp).
			ownPropNames = distinct ( getOwnPropertyNames ( o ) );
		} catch ( ex ) { ownPropNames = []; }

		for ( var i = 0 ; i < ownPropNames.length ; i++ ) {
			var name = ownPropNames [i],
				pd = getOwnPropertyDescriptor ( o, name ),
				attributes = '';
			
			if ( pd.configurable )	attributes += 'c';
			if ( pd.enumerable )	attributes += 'e';
			if ( pd.writable )		attributes += 'w';
			if ( pd.get )			attributes += 'g';
			if ( pd.set )			attributes += 's';
			if ( setOwnFlag )		attributes += 'o';

			prop = {
				parentValue : parentValue,
				name : name,
				attributes : attributes,
				value : null
			};

			prop.value = reflectValue ( o, name, oPath, prop );
			push.call ( props, prop );
		}

		return	props;
	},
	reflectProperties = function ( o : any, oPath : any [],
		parentValue : ReflectedValue = null, scanInherited = false )
	{
		var props = reflectOwnProperties ( o, oPath, parentValue, true, true );

		if ( scanInherited ) {
			var proto : any = null;

			try {
				proto = getPrototypeOf ( o );
			} catch ( ex ) {}

			while ( proto !== null /* TODO: and not chained */ ) {
				var protoProps = reflectOwnProperties ( proto, oPath, parentValue, false, false );

				for ( var i = 0 ; i < protoProps.length ; i++ ) {
					var protoProp = protoProps [i],
						found = false;

					for ( var j = 0 ; j < props.length ; j++ ) {
						var prop = props [j];

						if ( protoProp.name === prop.name ) {
							found = true;
							break;
						}
					}

					if ( !found )
						push.call ( props, protoProp );
				}

				try {
					proto = getPrototypeOf ( proto );
				} catch ( ex ) {
					break;
				}
			}
		}

		sort.call ( props, function ( p1, p2 ) {
			if ( p1.name === p2.name )
				return	0;
			else {
				if ( p1.name === null )
					return	-1;
				else if ( p2.name === null )
					return	1;
				else if ( p1.name < p2.name )
					return	-1;
				else
					return	1;
			}
		} );

		return	props;
	},
	checkObjectHasProperties = function ( o : any ) {
		var hasProto : bool;

		try {
			hasProto = getPrototypeOf ( o ) !== null;
		} catch ( ex ) { hasProto = false; }

		if ( hasProto )
			return	true;

		var hasOwnProps : bool;

		try {
			hasOwnProps = getOwnPropertyNames ( o ).length !== 0;
		} catch ( ex ) { hasOwnProps = false; }

		return	hasOwnProps;
	},
	validateTreeQueryNode = function ( node : ReflectByTreeQueryNode ) {
		if ( node == null || typeof node !== 'object' )
			throwProtocolMismatch ( 'Invalid query node "' + node + '".' );
		else if ( typeof node.name !== 'string' && node.name !== null )
			throwProtocolMismatch ( 'Query node must have its "name" property set to string or null value.' );
		else if ( !isArray ( node.props ) )
			throwProtocolMismatch ( 'Query node must contain array in its "props" property.' );
	},
	reflectByTreeProps = function ( o : any,
		reflProps : ReflectedProperty [], propsToReflect : ReflectByTreeQueryNode [],
		scanInherited = false ) : void
	{
		for ( var i = 0 ; i < propsToReflect.length ; i++ ) {
			var propToReflect = propsToReflect [i];
			validateTreeQueryNode ( propToReflect );

			for ( var j = 0 ; j < reflProps.length ; j++ ) {
				var reflProp = reflProps [j];

				if ( reflProp.name === propToReflect.name ) {
					var propValue : any,
						success = true;

					try {
						if ( propToReflect.name === null )
							propValue = getPrototypeOf ( o );
						else
							propValue = o [propToReflect.name];
					} catch ( ex ) {
						success = false;
					}

					if ( success ) {
						var reflPropValue = reflProp.value;
						reflPropValue.properties = reflectProperties ( propValue,
							reflPropValue.path, reflPropValue,
							scanInherited );
						reflPropValue.hasProperties = reflPropValue.properties.length !== 0;

						if ( propToReflect.props.length ) {
							reflectByTreeProps ( propValue,
								reflPropValue.properties, propToReflect.props,
								scanInherited );
						}
					}

					break;
				}
			}
		}
	},
	reflect = function ( o : any, path : string [], props : ReflectByTreeQueryNode [], scanInherited = false ) {
		var oRefl : ReflectedValue = null,
			oPath : string [] = [];

		try {
			o = retrieveByPath ( o, slice.call ( path, 0, path.length - 1 ), oPath );

			var name = path [path.length - 1],
				outPropValue : IOutArg = { value : undefined };

			oRefl = reflectValue ( o, name, oPath, null, outPropValue );

			if ( props !== null ) {
				oRefl.properties = reflectProperties ( outPropValue.value, path, oRefl, scanInherited );
				oRefl.hasProperties = oRefl.properties.length !== 0;
				reflectByTreeProps ( outPropValue.value, oRefl.properties, props, scanInherited );
			}
		} catch ( ex ) {
			oRefl = {
				parentProperty : null,
				value : exceptionFreeToString ( ex ),
				success : false,
				hasCustomStringRepr : true,
				path : oPath,
				type : null,
				hasProperties : false,
				properties : []
			};
		}

		return	oRefl;
	},
	retrieveByPath = function ( o : any, path : string [], outPath? : string [] ) {
		var name : string;

		for ( var i = 0 ; i < path.length ; i++ ) {
			name = path [i];

			if ( outPath )
				push.call ( outPath, name );

			if ( name === null )
				o = getPrototypeOf ( o );
			else
				o = o [name];
		}

		return	o;
	},
	assignByPath = function ( o : any, path : string [], value : any, outPath? : string [] ) {
		var name : string;

		for ( var i = 0 ; i < path.length - 1 ; i++ ) {
			name = path [i];

			if ( outPath )
				push.call ( outPath, name );

			if ( name === null )
				o = getPrototypeOf ( o );
			else
				o = o [name];
		}

		name = path [i];

		if ( name === null )
			throw new TypeError ( 'Can\'t change prototype of an instance.' );

		o [name] = value;

		if ( outPath )
			push.call ( outPath, name );

		return	o;
	},
	assignInternal = function ( srcPath : string [], dstPath : string [] ) {
		var o = retrieveByPath ( storedObjects, srcPath );
		assignByPath ( storedObjects, dstPath, o );
	},
	storedObjects = [],
	storeObject = function ( o : any ) {
		var idx = indexOf.call ( storedObjects, o );

		if ( idx === -1 ) {
			idx = storedObjects.length;
			push.call ( storedObjects, o );
		}

		return	idx;
	},
	guestConsoleDir = function ( o : any ) {
		if ( !outputNotificationsEnabled )
			return;

		var storedObjectId = storeObject ( o );
		sendDirNotification ( storedObjectId );
	},
	guestConsoleLog = function () {
		if ( !outputNotificationsEnabled )
			return;

		var msg = '';

		for ( var i = 0 ; i < arguments.length ; i++ ) {
			msg += exceptionFreeToString ( arguments [i] ) + ' ';
		}

		msg = substr.call ( msg, 0, msg.length - 1 ) + "\n";
		sendLogNotification ( msg );
	},
	guestExec = function ( code : string, parseResult : ParseIdentifiersResult, reqId : number ) {
		var error = null;
		addGuestGlobalIds ( parseResult.identifiers );
		tailExprValue = undefined;

		if ( parseResult.tailExprStart >= 0 ) {
			// TODO: check that parseResult.tailExprStart < code.length.
			/* TODO: reading of tail expression value might be implemented with insertion of return statement.
			 * This way we get rid of this ["♑"] property. Guest variables might be stored immediately before
			 * return statement because tail expression cannot define new identifiers. */
			code = substr.call ( code, 0, parseResult.tailExprStart ) +
				'this ["♑"].tailExprValue=' + substr.call ( code, parseResult.tailExprStart );
		}

		/* TODO: prove that this.Function.prototype.constructor = undefined;
		 * eliminates all the range of possibilities to call new Function ( 'code' ).
		 * UPD: Check whether guest code new Function ( 'console.log ( this )' ) (); outputs
		 * null in strict mode and not global object of the sandbox.
		 * UPD: no, result is not null but real global object. Restriction on Function type
		 * ( and its constructor ) is really necessary. */
		var guestCodeFunc : any;

		try {
			// TODO: prohibit return statement when code executed in root scope
			var guestCodeFunc = new FunctionCtor (
				'"use strict";' + "\n" +
				'var self = this;' + "\n" +
				'var console = this.console;' + "\n" +
				'var log = this.log = this.console.log;' + "\n" +
				'var dir = this.dir = this.console.dir;' + "\n" +
				'var alert = this.alert = this.console.log;' + "\n" +
				undefToughGlobalsCode + "\n" +
				restoreGuestGlobalsCode + "\n" +
				code + "\n" +
				saveGuestGlobalsCode + "\n"
			);

			// try-catch-finally version:
			//var guestCodeFunc = new FunctionCtor (
			//	'"use strict";' + "\n" +
			//	'var self = this;' + "\n" +
			//	'var console = this.console;' + "\n" +
			//	'var log = this.log = this.console.log;' + "\n" +
			//	'var dir = this.dir = this.console.dir;' + "\n" +
			//	'var alert = this.alert = this.console.log;' + "\n" +
			//	undefToughGlobalsCode + "\n" +
			//	restoreGuestGlobalsCode + "\n" +
			//	'try {' + "\n" +
			//	code + "\n" +
			//	'} catch ( executionError ) { throw executionError; }' + "\n" +
			//	'finally {' + "\n" +
			//	saveGuestGlobalsCode + "\n" +
			//	'}' + "\n"
			//);
		} catch ( parseError ) {
			error = parseError;
		}

		if ( error === null ) {
			try {
				guestCodeFunc.call ( guestScope );
			} catch ( executionError ) {
				/* TODO: executionError represents leak in type protection.
				 * Guest code can throw its own type of exception with for expample 'message' property
				 * defined as getter. And when getter called, it can eval malicious code in global context.
				 * UPD: it's ok. We use exceptionFreeToString ( error ) to get its string representation.
				 * UPD: In future we may pass error as stored object id and allow user to inspect its contents. */
				error = executionError;
			}
		}

		// TODO: temporary code. Revise this.
		for ( var i = 0 ; i < guestGlobalIds.length ; i++ ) {
			var varName = guestGlobalIds [i].name;

			try {
				storedObjects ['Scope'][varName] = guestScope [varName];
			} catch ( varRetrievalError ) {
				storedObjects ['Scope'][varName] = varRetrievalError;
			}
		}

		if ( error === null ) {
			var storedResultId = storeObject ( tailExprValue );
			sendExecResponse ( reqId, storedResultId );
		} else
			sendRequestFailed ( reqId, 'exec-request', error );

		//// <DEBUG check jailbreaks>
		//var a = [1, 2];
		//a.splice ( 0, 1 );
		//console.log ( a.splice );

		//var o : any = {};
		//o.constructor.getOwnPropertyNames ( o );
		//console.log ( o.constructor.getOwnPropertyNames );

		//( function () {} ).bind ( this );
		//// </DEBUG check jailbreaks>
	},
	throwProtocolMismatch = function ( message : string ) {
		throw new TypeError ( 'Protocol mismatch. ' + message );
	},
	pathIsValid = function ( path : string [] ) {
		if ( !isArray ( path ) || path.length < 1 )
			return	false;
		else {
			for ( var i = 0 ; i < path.length ; i++ ) {
				var e = path [i];

				if ( typeof e !== 'string' && e !== null )
					return	false;
			}
		}

		return	true;
	},
	onExecRequest = function ( data : any, reqId : number ) {
		if ( typeof data.code !== 'string' )
			throwProtocolMismatch ( 'Packet should have its "code" field set to string value.' );
		else if ( data.parseResult == null || typeof data.parseResult !== 'object' ||
			!isArray ( data.parseResult.identifiers ) || !isInt ( data.parseResult.tailExprStart ) )
		{
			throwProtocolMismatch ( 'Packet field "parseResult" value is malformed.' );
		} else {
			var ids = data.parseResult.identifiers;

			for ( var i = 0 ; i < ids.length ; i++ ) {
				var id = ids [i];

				if ( typeof id.name !== 'string' || typeof id.type !== 'string' )
					throwProtocolMismatch ( 'One of the packet "parseResult.identifiers" has no "name" or "type" field.' );
			}
		}

		outputNotificationsEnabled = true;
		guestExec ( data.code, data.parseResult, reqId );
	},
	onReflectRequest = function ( data : any, reqId : number ) {
		if ( !pathIsValid ( data.path ) )
			throwProtocolMismatch ( '"path" field of the packet must be non-empty array consisting of string and/or null values.' );

		if ( data.props !== null && !isArray ( data.props ) )
			throwProtocolMismatch ( '"props" field must be either array consisting of string and/or null values or null.' );

		if ( typeof data.scanInherited !== 'boolean' )
			throwProtocolMismatch ( '"scanInherited" field must be boolean.' );

		var oRefl = reflect ( storedObjects, data.path, data.props, data.scanInherited );
		sendReflectResponse ( reqId, oRefl, data.path, data.props, data.scanInherited );
	},
	onAssignInternalRequest = function ( data : any, reqId : number ) {
		if ( !pathIsValid ( data.srcPath ) || !pathIsValid ( data.dstPath ) )
			throwProtocolMismatch ( '"srcPath" and "dstPath" fields of the packet must be non-empty arrays consisting of string and/or null values.' );

		assignInternal ( data.srcPath, data.dstPath );
		sendAssignInternalResponse ( reqId, data.srcPath, data.dstPath );
	},
	sendResponse = function ( type : string, id : number, data : any ) {
		postMessage.call ( null, {
			type : type,
			id : id,
			data : data
		} );
	},
	sendNoitification = function ( type : string, data? : any ) {
		postMessage.call ( null, {
			type : type,
			id : null,
			data : data
		} );
	},
	sendReflectResponse = function ( reqId : number, oRefl : ReflectedValue,
		path : string [], props : ReflectByTreeQueryNode [], scanInherited : bool )
	{
		sendResponse ( 'reflect-response', reqId, {
			oRefl : oRefl,
			path : path,
			props : props,
			scanInherited : scanInherited
		} );
	},
	sendAssignInternalResponse = function ( reqId : number, srcPath : string [], dstPath : string [] ) {
		sendResponse ( 'assign-internal-response', reqId, {
			srcPath : srcPath,
			dstPath : dstPath
		} );
	},
	sendLogNotification = function ( message : string ) {
		sendNoitification ( 'log', {
			message : message
		} );
	},
	sendExecResponse = function ( reqId : number, storedResultId : number ) {
		sendResponse ( 'exec-response', reqId, {
			storedResultId : storedResultId
		} );
	},
	sendDirNotification = function ( storedObjectId ) {
		sendNoitification ( 'dir', {
			storedObjectId : storedObjectId
		} );
	},
	sendReadyNotification = function () {
		sendNoitification ( 'ready' );
	},
	sendRequestFailed = function ( reqId : number, requestType : string, error : Error ) {
		sendResponse ( 'request-failed', reqId, {
			requestType : requestType,
			error : exceptionFreeToString ( error )
		} );
	},
	onMessage = function ( ev : MessageEvent ) {
		try {
			var pkt = <SandboxPacket> ev.data;

			if ( typeof pkt !== 'object' || pkt === null )
				throwProtocolMismatch ( 'Packet must be an object.' );
			else if ( typeof pkt.type !== 'string' )
				throwProtocolMismatch ( 'Packet must have string "type" field.' );
			else if ( !( 'data' in pkt ) )
				throwProtocolMismatch ( 'Packet must have "data" field.' );
			else if ( !isInt ( pkt.id ) )
				throwProtocolMismatch ( 'Packet must have integer "id" field.' );

			var data = pkt.data;
			
			try {
				if ( pkt.type === 'exec-request' )
					onExecRequest ( data, pkt.id );
				else if ( pkt.type === 'reflect-request' )
					onReflectRequest ( data, pkt.id );
				else if ( pkt.type === 'assign-internal-request' )
					onAssignInternalRequest ( data, pkt.id );
			} catch ( requestExecutionError ) {
				sendRequestFailed ( pkt.id, pkt.type, requestExecutionError );
			}
		} catch ( internalError ) {
			/* NOTE: at this point postMessage might be inaccessible or corrupt.
			 * That's why we use standard mechanism of transferring error information
			 * from worker code to host by using worker.onerror event. */
			var exInfo : any = null;

			try {
				var stack : string = internalError.stack;

				if ( typeof stack === 'string' )
					exInfo = stack;
			} catch ( dummy ) {}

			if ( exInfo === null ) {
				try {
					/* NOTE: jailbreak could redefine exceptionFreeToString (),
					 * that's why try-catch is here. */
					exInfo = exceptionFreeToString ( internalError );
				} catch ( dummy ) {
					/* No way to get description, fallback to exception itself.
					 * Note that there are chances that no helpful information
					 * will get to worker.onerror because it seems that only strings
					 * can be passed to worker.onerror event handler without reducing
					 * some parts of information. */
					exInfo = internalError;
				}
			}

			throw exInfo;
		} finally {
			outputNotificationsEnabled = false;
		}
	},
	initHost = function () {
		global.addEventListener ( 'message', onMessage.bind ( this ), false );
		var globals = Object.getOwnPropertyNames ( global );

		// TODO: walk prototype chain manually because for..in omits non-enumerable properties.
		for ( var k in global ) {
			if ( -1 === globals.indexOf ( k ) )
				globals.push ( k );
		}

		var toughGlobals : string [] = [];
		
		for ( var i = 0 ; i < globals.length ; i++ ) {
			var k = globals [i];

			if ( -1 !== allowedIdentifiers.indexOf ( k ) || k === 'self' )
				continue;

			global [k] = undefined;

			if ( global [k] !== undefined )
				toughGlobals.push ( k );
		}

		if ( toughGlobals.length > 0 ) {
			undefToughGlobalsCode = 'var ';

			for ( i = 0 ; i < toughGlobals.length ; i++ )
				undefToughGlobalsCode += toughGlobals [i] + ',';

			undefToughGlobalsCode = undefToughGlobalsCode.substr ( 0, undefToughGlobalsCode.length - 1 ) + ';';
		}
		
		for ( var i = 0 ; i < allowedIdentifiers.length ; i++ ) {
			var typeName = allowedIdentifiers [i];
			/* TODO: use Object.defineProperty and Object.getOwnPropertyDescriptor when
			 * copying identifiers from global scope to guestScope. This will make
			 * NaN, Infinity and undefined read only. And maybe some other identifiers will
			 * gain benefit from this too. */
			guestScope [typeName] = global [typeName];
		}

		( <any> Math ).random = ( function ( seed ) {
			// TODO: make some other pseudo-random seed-based func.
			var PI2 = Math.PI * 2,
				sin = Math.sin,
				abs = Math.abs,
				angle = seed % PI2;

			return	function () {
				var r = abs ( sin ( angle ) );
				angle = ( angle + seed ) % PI2;
				
				return	r;
			};
		} ) ( 70 * Math.PI / 180 ).bind ( Math );

		guestScope ['console'] = {};
		// TODO: implement other console methods like console.warn, console.error etc.
		guestScope ['console'].log = bind.call ( guestConsoleLog, this );
		guestScope ['console'].dir = bind.call ( guestConsoleDir, this );
		// TODO: implement console.clear (). Guest is only owner of console, so clearing should be permitted.
		/* TODO: read https://getfirebug.com/wiki/index.php/Command_Line_API
		 * There might be useful methods to implement. */

		storedObjects ['Globals'] = guestScope;
		storedObjects ['Scope'] = Object.create ( null );

		/* TODO: make a 'secret' instead of '♑'. Secret generated randomly
		 * and it's long enough to avoid guessing. Also it's not enumerable and
		 * Object.getOwnPropertyNames excludes this property from results. */
		Object.defineProperty ( guestScope, '♑', {
			configurable : false,
			enumerable : false,
			writable : false,
			value : Object.create ( null, {
				'tailExprValue' : {
					configurable : false,
					enumerable : false,
					set : function ( value ) { tailExprValue = value; }
				}
			} )
		} );

		// Protect 'call' method.
		Object.defineProperty ( FunctionCtor.prototype, 'call', {
			configurable : false,
			writable : false
		} );

		function bindInternal ( func, thisArg, arguments ) {
			var boundFunction = bind.apply ( func, arguments );

			defineProperty ( boundFunction, 'targetFunction', {
				configurable : false,
				enumerable : false,
				writable : false,
				value : func
			} );

			defineProperty ( boundFunction, 'boundThisArg', {
				configurable : false,
				enumerable : false,
				writable : false,
				value : thisArg
			} );

			defineProperty ( boundFunction, 'boundArguments', {
				configurable : false,
				enumerable : false,
				writable : false,
				value : freeze ( slice.call ( arguments, 1 ) )
			} );

			return	boundFunction;
		}

		Object.defineProperty ( FunctionCtor.prototype, 'bind', {
			configurable : false,	// TODO: this is not necessary. Guest should have possibility to redefine this function.
			writable : false,		// TODO: this too.
			value : function ( thisArg : any ) {
				return	bindInternal ( this, thisArg, arguments );
			}
		} );

		// Disable evaluation of arbitrary code by using new Function ( 'code' ).
		FunctionCtor.prototype ['constructor'] = undefined;

		sendReadyNotification ();
	};

	initHost ();
} ) ();