/// <reference path="sandbox-defs.ts" />
"use strict";

interface RequestFailCallback {
	( error : any, userData : any ) : void;
}

interface RequestAlwaysCallback {
	( userData : any ) : void;
}

interface ResponseHandler {
	done : Function;	// Actual type is specific to particular response kind.
	fail : RequestFailCallback;
	always : RequestAlwaysCallback;
	userData : any;
}

interface RequestQueueItem {
	handler : ResponseHandler;
	packet : SandboxPacket;
	timeout : number;
}

interface EventCallbackCollection {
	[eventType : string] : Function [];
}

interface DeferredCallback {
	cb : Function;
	args : any [];
}

interface DefferedEvent {
	ev : string;	// eventType.
	args : any [];
}

declare class ErrorClass implements Error {
    public name : string;
    public message : string;
    constructor ();
}

this.ErrorClass = Error;

class ProtocolMismatchError extends ErrorClass {
	public name = 'ProtocolMismatchError';
	public message : string;

	constructor ( public mismatchDescription : string, public packetType? : string ) {
		super ();
		this.message = 'Could not parse incoming packet';

		if ( typeof this.packetType === 'string' )
			this.message += ' "' + this.packetType + '"';

		this.message += '. ' + mismatchDescription;
	}

	public toString () {
		return	this.name + ': ' + this.message;
	}
}

class RequestExecutionError extends ErrorClass {
	public name = 'RequestExecutionError';
	public message : string;

	constructor ( public serverMessage : string, public requestType : string ) {
		super ();
		this.message = 'Server failed to process "' + requestType +
			'" request. It said: "' + serverMessage + '"';
	}

	public toString () {
		return	this.name + ': ' + this.message;
	}
}

class RequestTimeoutError extends ErrorClass {
	public name = 'RequestTimeoutError';
	public message : string;

	constructor ( public requestType : string, public timeout : number ) {
		super ();
		this.message = timeout + ' milliseconds to execute the "' + requestType + '" request has expired.';
	}

	public toString () {
		return	this.name + ': ' + this.message;
	}
}

class RequestIgnoredError extends ErrorClass {
	public name = 'RequestIgnoredError';
	public message : string;

	constructor ( public requestType : string ) {
		super ();
		this.message = 'Request "' + requestType + '" was ignored by the server.';
	}

	public toString () {
		return	this.name + ': ' + this.message;
	}
}

class SandboxTerminatedError extends ErrorClass {
	public name = 'SandboxTerminatedError';
	public message : string;

	constructor ( public requestType : string ) {
		super ();
		this.message = 'Sandbox was terminated, so request "' + requestType + '" cannot be processed.';
	}

	public toString () {
		return	this.name + ': ' + this.message;
	}
}

class InitTimeoutError extends ErrorClass {
	public name = 'InitTimeoutError';
	public message : string;

	constructor ( public timeout : number ) {
		super ();
		this.message = timeout + ' milliseconds to initialize sandbox has expired.';
	}

	public toString () {
		return	this.name + ': ' + this.message;
	}
}

// TODO: implement debug option 'logPackets'. This must work on both sides, here and in sandbox-core.
class Sandbox {
	public static ReadyEvent = 'ready';
	public static LogEvent = 'log';
	public static DirEvent = 'dir';
	public static ExecFinishedEvent = 'execFinished';
	public static StateChangedEvent = 'stateChanged';
	public static RequestTimeoutEvent = 'requestTimeout';
	public static InternalErrorEvent = 'internalError';
	public static TerminatedEvent = 'terminated';
	private S;	// Shorthand for esprima.Syntax.
	private worker : Worker;
	private workerInitialized = false;
	private workerTerminated = false;
	public get isReady () { return	this.workerInitialized && !this.workerTerminated; }
	public get isTerminated () { return	this.workerTerminated; }
	private nextReqId = 0;
	private reqQueue : RequestQueueItem [] = [];
	private evCallbacks = <EventCallbackCollection> {};
	private reqTimeoutTimerId = -1;
	private _defaultRequestTimeout : number;
	public get defaultRequestTimeout () { return	this._defaultRequestTimeout; }
	public set defaultRequestTimeout ( value : number ) {
		this._defaultRequestTimeout = this.coerceTimeoutValue ( value );
	}
	private initTimeoutTimerId = -1;
	private _initTimeout : number;
	public get initTimeout () { return	this._initTimeout; }
	public reportUnhandledRequestFailures = true;
	private static stateChangingRequests = ['exec-request', 'assign-internal-request'];
	
	constructor ( private esprima : any, defaultRequestTimeout = 5000, initTimeout = 30000 ) {
		this.S = esprima.Syntax;
		this.worker = new Worker ( 'sandbox-core.js' );
		this.worker.onmessage = this.onmessage.bind ( this );
		this.worker.onerror = this.onerror.bind ( this );
		this.defaultRequestTimeout = defaultRequestTimeout;
		this._initTimeout = this.coerceTimeoutValue ( initTimeout );

		if ( isFinite ( this._initTimeout ) )
			this.initTimeoutTimerId = setTimeout ( this.initTimeoutCallback.bind ( this ), this._initTimeout );
	}

	public onReady ( callback : () => void ) {
		this.on ( Sandbox.ReadyEvent, callback );
	}

	public onLog ( callback : ( message : string ) => void ) {
		this.on ( Sandbox.LogEvent, callback );
	}

	public onDir ( callback : ( storedObjectId : number ) => void ) {
		this.on ( Sandbox.DirEvent, callback );
	}

	public onExecFinished ( callback : ( success : bool, storedResultId : number, error : any ) => void ) {
		this.on ( Sandbox.ExecFinishedEvent, callback );
	}

	public onStateChanged ( callback : () => void ) {
		this.on ( Sandbox.StateChangedEvent, callback );
	}

	public onRequestTimeout ( callback : ( requestType : string, timeout : number ) => void ) {
		this.on ( Sandbox.RequestTimeoutEvent, callback );
	}

	public onInternalError ( callback : ( error : any ) => void ) {
		this.on ( Sandbox.InternalErrorEvent, callback );
	}

	public onTerminated ( callback : () => void ) {
		this.on ( Sandbox.TerminatedEvent, callback );
	}

	private on ( eventType : string, callback : Function ) {
		this.validateCallbackArg ( 'callback', callback );
		var evTypeCallbacks = this.evCallbacks [eventType];

		if ( evTypeCallbacks == null )
			evTypeCallbacks = this.evCallbacks [eventType] = [callback];
		else {
			for ( var i = 0 ; i < evTypeCallbacks.length ; i++ ) {
				var existingCallback = evTypeCallbacks [i];

				if ( existingCallback === callback )
					return	false;
			}

			evTypeCallbacks.push ( callback );
		}

		return	true;
	}

	public off ( eventType : string, callback : Function ) {
		var evTypeCallbacks = this.evCallbacks [eventType];

		if ( evTypeCallbacks != null ) {
			for ( var i = 0 ; i < evTypeCallbacks.length ; i++ ) {
				var existingCallback = evTypeCallbacks [i];

				if ( existingCallback === callback ) {
					evTypeCallbacks.splice ( i, 1 );

					if ( evTypeCallbacks.length === 0 )
						delete	this.evCallbacks [eventType];

					return	true;
				}
			}
		}

		return	false;
	}

	private fire ( eventType : string, args : any [] ) {
		var evTypeCallbacks = this.evCallbacks [eventType];

		if ( evTypeCallbacks != null ) {
			for ( var i = 0 ; i < evTypeCallbacks.length ; i++ ) {
				this.invokeUserCallback ( evTypeCallbacks [i], args );
			}
		}
	}

	private invokeUserCallback ( callback : Function, args : any [] ) {
		try {
			callback.apply ( null, args );
		} catch ( callbackError ) {
			this.traceError ( callbackError, 'User callback thrown error.' );
		}
	}

	private enqueueRequest (
		type : string, data : any,
		done : Function,
		fail : RequestFailCallback,
		always : RequestAlwaysCallback,
		userData? : any,
		timeout? : number )
	{
		this.validateCallbackArg ( 'done', done );
		this.validateCallbackArg ( 'fail', fail );
		this.validateCallbackArg ( 'always', always );

		var resHandler : ResponseHandler = {
			done : done,
			fail : fail,
			always : always,
			userData : userData
		};

		if ( typeof timeout === 'undefined' )
			timeout = this._defaultRequestTimeout;
		else
			timeout = this.coerceTimeoutValue ( timeout );

		this.reqQueue.push ( {
			handler : resHandler,
			packet : {
				type : type,
				id : this.nextReqId++,
				data : data
			},
			timeout : timeout
		} );

		if ( this.workerTerminated )
			this.reportTerminatedToAllCallbacks ();
		else if ( this.workerInitialized && this.reqQueue.length === 1 )
			this.sendRequest ( this.reqQueue [0] );
	}

	private indexOfRequest ( id : number ) {
		for ( var i = 0 ; i < this.reqQueue.length ; i++ ) {
			if ( id === this.reqQueue [i].packet.id )
				return	i;
		}

		return	-1;
	}

	private sendRequest ( request : RequestQueueItem ) {
		this.worker.postMessage ( request.packet );

		if ( isFinite ( request.timeout ) )
			this.reqTimeoutTimerId = setTimeout ( this.requestTimeoutCallback.bind ( this ), request.timeout );
	}

	private reportRequestFailure ( request : RequestQueueItem, error : any ) {
		var handler = request.handler;

		if ( handler.fail )
			this.invokeUserCallback ( handler.fail, [error, handler.userData] );
		else
			this.reportUnhandledRequestFail ( error, request.packet.type );

		if ( handler.always )
			this.invokeUserCallback ( handler.always, [handler.userData] );

		if ( request.packet.type === 'exec-request' )
			this.fire ( Sandbox.ExecFinishedEvent, [false, -1, error] );

		if ( -1 !== Sandbox.stateChangingRequests.indexOf ( request.packet.type ) )
			this.fire ( Sandbox.StateChangedEvent, [] );
	}

	private initTimeoutCallback () {
		try {
			this.initTimeoutTimerId = -1;

			var initTimeoutError = Object.freeze ( new InitTimeoutError ( this._initTimeout ) );
			this.reportInternalError ( initTimeoutError );
			this.terminate ( true );
		} catch ( internalError ) {
			this.reportInternalError ( internalError );
		}
	}

	private requestTimeoutCallback () {
		try {
			this.reqTimeoutTimerId = -1;
			var request = this.reqQueue.shift ();

			if ( this.reqQueue.length !== 0 )
				this.sendRequest ( this.reqQueue [0] );

			var reqTimeoutError = Object.freeze (
				new RequestTimeoutError ( request.packet.type, request.timeout )
			);

			this.reportRequestFailure ( request, reqTimeoutError );
			this.fire ( Sandbox.RequestTimeoutEvent, [request.packet.type, request.timeout] );
		} catch ( internalError ) {
			this.reportInternalError ( internalError );
		}
	}

	private reportTerminatedToAllCallbacks () {
		while ( this.reqQueue.length !== 0 ) {
			var request = this.reqQueue.shift (),
				sandboxTerminatedError = Object.freeze ( new SandboxTerminatedError ( request.packet.type ) );

			this.reportRequestFailure ( request, sandboxTerminatedError );
		}
	}

	public terminate ( processCallbacks = true ) {
		if ( this.workerTerminated )
			return;

		this.worker.terminate ();
		this.workerTerminated = true;

		if ( this.reqTimeoutTimerId !== -1 ) {
			clearTimeout ( this.reqTimeoutTimerId );
			this.reqTimeoutTimerId = -1;
		}

		if ( this.initTimeoutTimerId !== -1 ) {
			clearTimeout ( this.initTimeoutTimerId );
			this.initTimeoutTimerId = -1;
		}

		if ( processCallbacks )
			this.reportTerminatedToAllCallbacks ();

		this.fire ( Sandbox.TerminatedEvent, [] );
		this.evCallbacks = {};
	}

	public exec ( code : string,
		done? : ( storedResultId : number, userData : any ) => void,
		fail? : RequestFailCallback, always? : RequestAlwaysCallback,
		userData? : any, timeout? : number )
	{
		var parseResult = this.parse ( code );

		this.enqueueRequest ( 'exec-request', {
			code : code,
			parseResult : parseResult
		}, done, fail, always, userData, timeout );
	}

	/* NOTE: when 'props' argument is null it means that properties of
	 * object obtained by path should be reflected. If its values is empty array
	 * then properties should be reflected but not expanded. */
	public reflect ( path : string [], props : ReflectByTreeQueryNode [], scanInherited : bool,
		done : ( reflectedObject : ReflectedValue,
			path : string [], props : ReflectByTreeQueryNode [], scanInherited : bool, userData : any ) => void,
		fail? : RequestFailCallback, always? : RequestAlwaysCallback,
		userData? : any, timeout? : number )
	{
		this.enqueueRequest ( 'reflect-request', {
			path : path,
			props : props,
			scanInherited : scanInherited
		}, done, fail, always, userData, timeout );
	}

	public assignInternal ( srcPath : string [], dstPath : string [],
		done : ( srcPath : string [], dstPath : string [], userData : any ) => void,
		fail? : RequestFailCallback, always? : RequestAlwaysCallback,
		userData? : any, timeout? : number )
	{
		this.enqueueRequest ( 'assign-internal-request', {
			srcPath : srcPath,
			dstPath : dstPath
		}, done, fail, always, userData, timeout );
	}

	private onmessage ( ev : MessageEvent ) {
		var cbQueue : DeferredCallback [] = [],
			evQueue : DefferedEvent [] = [];

		try {	// Catch sandbox internal errors as well as general protocol mismatch exceptions.
			var pkt = <SandboxPacket> ev.data;

			if ( typeof pkt !== 'object' || pkt === null )
				throw new ProtocolMismatchError ( 'Packet must be an object.' );
			else if ( typeof pkt.type !== 'string' )
				throw new ProtocolMismatchError ( 'Packet must have string "type" field.' );
			else if ( !( 'data' in pkt ) )
				throw new ProtocolMismatchError ( 'Packet must have "data" field.' );

			var data = pkt.data;
			
			if ( typeof pkt.id !== 'undefined' && pkt.id !== null ) {	// Handle response packets
				if ( !Sandbox.isInt ( pkt.id ) )
					throw new TypeError ( 'Response has non-integer "id" field.' );

				var reqQueueIdx = this.indexOfRequest ( pkt.id );

				if ( reqQueueIdx === -1 )
					throw new ProtocolMismatchError ( 'A response was received to the request, which was not sent.', pkt.type );

				var currentRequest = this.reqQueue.splice ( reqQueueIdx, 1 ) [0],
					handler = currentRequest.handler;

				/* We've got a handler. Its 'fail' and 'always' callbacks
				 * must be queued in any circumstances. */
				try {
					if ( this.reqTimeoutTimerId !== -1 ) {
						clearTimeout ( this.reqTimeoutTimerId );
						this.reqTimeoutTimerId = -1;
					}

					if ( reqQueueIdx !== 0 ) {
						for ( var i = 0 ; i < reqQueueIdx ; i++ ) {
							var ignoredRequest = this.reqQueue.shift (),
								ighoredHandler = ignoredRequest.handler,
								reqIgnoredError = Object.freeze ( new RequestIgnoredError ( ignoredRequest.packet.type ) );

							cbQueue.push ( { cb : ighoredHandler.fail, args : [reqIgnoredError, ighoredHandler.userData] } );
							cbQueue.push ( { cb : ighoredHandler.always, args : [ighoredHandler.userData] } );
						}
					}

					if ( pkt.type === 'request-failed' ) {
						var reqFailedError = Object.freeze ( new RequestExecutionError ( data.error, data.requestType ) );

						if ( handler.fail )
							cbQueue.push ( { cb : handler.fail, args : [reqFailedError, handler.userData] } );
						else
							this.reportUnhandledRequestFail ( reqFailedError, data.requestType );
						
						if ( data.requestType === 'exec-request' )
							evQueue.push ( { ev : Sandbox.ExecFinishedEvent, args : [false, -1, reqFailedError] } );

						if ( -1 !== Sandbox.stateChangingRequests.indexOf ( data.requestType ) )
							evQueue.push ( { ev : Sandbox.StateChangedEvent, args : [] } );
					} else if ( pkt.type === 'exec-response' ) {
						if ( !Sandbox.isInt ( data.storedResultId ) )
							throw new ProtocolMismatchError ( 'Packet.storedResultId is expected to be integer.', pkt.type );

						if ( handler.done )
							cbQueue.push ( { cb : handler.done, args : [data.storedResultId, handler.userData] } );
						
						evQueue.push ( { ev : Sandbox.ExecFinishedEvent, args : [true, data.storedResultId, null] } );
						evQueue.push ( { ev : Sandbox.StateChangedEvent, args : [] } );
					} else if ( pkt.type === 'reflect-response' ) {
						if ( typeof data.oRefl !== 'object' || data.oRefl === null )
							throw new ProtocolMismatchError ( 'Packet.oRefl must be an object.', pkt.type );
						else if ( !Array.isArray ( data.path ) )
							throw new ProtocolMismatchError ( 'Packet.path is not an array.', pkt.type );
						else if ( data.props !== null && !Array.isArray ( data.props ) )
							throw new ProtocolMismatchError ( 'Packet.props is not array or null.', pkt.type );
						else if ( typeof data.scanInherited !== 'boolean' )
							throw new ProtocolMismatchError ( 'Packet.scanInherited must be boolean.', pkt.type );

						if ( handler.done ) {
							cbQueue.push ( {
								cb : handler.done,
								args : [data.oRefl, data.path, data.props, data.scanInherited, handler.userData]
							} );
						}
					} else if ( pkt.type === 'assign-internal-response' ) {
						if ( !Array.isArray ( data.srcPath ) || !Array.isArray ( data.dstPath ) )
							throw new ProtocolMismatchError ( 'Either Packet.srcPath or Packet.dstPath is not an array.', pkt.type );

						if ( handler.done ) {
							cbQueue.push ( {
								cb : handler.done,
								args : [data.srcPath, data.dstPath, handler.userData]
							} );
						}

						evQueue.push ( { ev : Sandbox.StateChangedEvent, args : [] } );
					}
				} catch ( processResponseFailure ) {
					processResponseFailure = Object.freeze ( processResponseFailure );

					if ( handler.fail )
						cbQueue.push ( { cb : handler.fail, args : [processResponseFailure, handler.userData] } );
					else
						this.reportUnhandledRequestFail ( processResponseFailure, pkt.type );

					this.traceError ( processResponseFailure, 'Error while processing response.' );
				} finally {
					if ( handler.always )
						cbQueue.push ( { cb : handler.always, args : [handler.userData] } );

					if ( this.reqQueue.length !== 0 )
						this.sendRequest ( this.reqQueue [0] );
				}
			} else {	// Handle notification packets
				if ( pkt.type === 'ready' ) {
					this.workerInitialized = true;

					if ( this.initTimeoutTimerId !== -1 )
						clearTimeout ( this.initTimeoutTimerId );

					evQueue.push ( { ev : Sandbox.ReadyEvent, args : [] } );
					
					if ( this.reqQueue.length !== 0 )
						this.sendRequest ( this.reqQueue [0] );
				} else if ( pkt.type === 'log' ) {
					if ( typeof data.message !== 'string' )
						throw new ProtocolMismatchError ( 'Packet.message is expected to be string.', pkt.type );

					evQueue.push ( { ev : Sandbox.LogEvent, args : [data.message] } );
				} else if ( pkt.type === 'dir' ) {
					if ( !Sandbox.isInt ( data.storedObjectId ) )
						throw new ProtocolMismatchError ( 'Packet.storedObjectId is expected to be integer.', pkt.type );

					evQueue.push ( { ev : Sandbox.DirEvent, args : [data.storedObjectId] } );
				}
			}
		} catch ( internalError ) {
			/* Internal sandbox-related error. This 'catch' clause might seem useless,
			 * however it is the only way to make possible handling of unexpected errors
			 * occured in the body of worker.onmessage callback. Without this clause such
			 * errors would be unseen and there would be no means to take the necessary
			 * measures upon their occurence. */
			evQueue.push ( { ev : Sandbox.InternalErrorEvent, args : [internalError] } );
			this.traceInternalError ( internalError );
		} finally {
			for ( var i = 0 ; i < cbQueue.length ; i++ ) {
				var deferredCallback = cbQueue [i];
				this.invokeUserCallback ( deferredCallback.cb, deferredCallback.args );
			}

			for ( var i = 0 ; i < evQueue.length ; i++ ) {
				var deferredEvent = evQueue [i];
				this.fire ( deferredEvent.ev, deferredEvent.args );
			}
		}
	}

	private onerror ( ev : ErrorEvent ) {
		var description = '';
		
		if ( ev.lineno )
			description += 'line ' + ev.lineno + ', ';

		if ( ev.colno )
			description += 'column ' + ev.colno + ', ';
		
		description += ev.message;
		this.reportInternalError ( description );
	}

	private reportUnhandledRequestFail ( error : any, requestType : string ) {
		if ( this.reportUnhandledRequestFailures ) {
			this.traceError ( error,
				'Request "' + requestType +
				'" has been failed but no "fail" callback provided by user.'
			);
		}
	}

	private reportInternalError ( error : any ) {
		this.traceInternalError ( error );
		this.fire ( Sandbox.InternalErrorEvent, [error] );
	}

	private traceInternalError ( error : any ) {
		this.traceError ( error, 'Sandbox internal error.' );
	}

	private traceError ( error : any, title? : string ) {
		if ( console ) {
			try {	// Beware of redefined console and its methods.
				var info : string = error.stack;

				if ( typeof info !== 'string' )
					info = error;

				if ( title )
					info = title + ' ' + info;

				if ( console.error )
					console.error ( info );
				else if ( console.warn )
					console.warn ( info );
				else if ( console.log )
					console.log ( info );
			} catch ( ex ) {}
		}
	}

	private parse ( code : string ) {
		var ast,
			res = <ParseIdentifiersResult> {
				identifiers : [],
				tailExprStart : -1
			};

		try {
			ast = this.esprima.parse ( code, { range : true } );
		} catch ( ex ) { return	res; }

		for ( var i = 0 ; i < ast.body.length ; i++ ) {
			var node = ast.body [i];

			if ( node.type === this.S.VariableDeclaration ) {
				for ( var j = 0 ; j < node.declarations.length ; j++ ) {
					var decl = node.declarations [j];

					if ( decl.type === this.S.VariableDeclarator ) {
						res.identifiers.push ( {
							type : 'var',
							name : decl.id.name
						} );
					}
				}
			} else if ( node.type === this.S.FunctionDeclaration ) {
				res.identifiers.push ( {
					type : 'function',
					name : node.id.name
				} );
			}
		}

		/* TODO: what about variables defined inside while(){}, do{}while(),
		 * for(;;){}, for (var..in), if(){}, else{} and block statement? */

		if ( ast.body.length > 0 ) {
			var node = ast.body [ast.body.length - 1];

			if ( node.type === this.S.ExpressionStatement )
				res.tailExprStart = node.range [0];
		}

		return	res;
	}

	private validateCallbackArg ( name, value ) {
		if ( value != null && typeof value !== 'function' )
			throw new TypeError ( 'Argument "' + name + '" must be a function.' );
	}

	private coerceTimeoutValue ( value : number ) {
		value = parseFloat ( <any> value );

		if ( isNaN ( value ) || value <= 0 )
			value = Number.POSITIVE_INFINITY;

		return	value;
	}

	private static isInt ( value : number ) {
		return	typeof value === 'number' && isFinite ( value ) && value === Math.ceil ( value );
	}
}