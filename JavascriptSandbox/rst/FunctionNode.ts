/// <reference path="ScopeNode.ts" />

enum FunctionStrictness {
	// User function, it is known whether it is strict or non-strict.
	Strict,
	NonStrict,
	// Non-user function, therefore its strictness is unknown.
	Unknown
}

// TODO: give it better name, yet unambiguous with 'InvocationData'.
interface FunctionCallData {
	caller : Function;
	arguments : IArguments;
}

class FunctionNode extends ScopeNode {
	private static FunctionNodeCounter = 0;
	public id : Identifier;
	public params : Identifier [];
	public body : BlockStatement;
	private runtimeParamNames : string [] = [];
	public funcNodeId : number;
	public programId : number;
	public isAnonymous : bool;
	public get defFuncVarInBody () { return	this.type === FunctionExpression.type && !this.isAnonymous; }
	private factoryFunc : Function = null;

	public rIsExecuting : number;

	constructor (
		id : Identifier,
		params : Identifier [] = [],
		body = new BlockStatement ( [] ),
		loc? : SourceLocation
	) {
		super ( loc );
		this.rIsExecuting = RstNode.maxRegisterId++;
		this.linkChild ( id, 'id' );
		this.linkChildren ( params, 'params' );
		this.linkChild ( body, 'body' );

		this.funcNodeId = FunctionNode.FunctionNodeCounter++;

		if ( this.id === null ) {
			this.name = 'anonymous';
			this.isAnonymous = true;
		} else {
			this.name = this.id.name;
			this.isAnonymous = false;
		}

		for ( var i = 0 ; i < this.params.length ; i++ ) {
			var paramNode = this.params [i],
				rtParamName = paramNode.name;
			 
			/* Function name should not be hidden by parameter name:
			 * we need to keep function reference accessible from
			 * its body in order to perform scope initialization when
			 * function invoked. */
			if ( rtParamName === this.name )
				rtParamName += '_';
			
			Runtime.builtin.push.call ( this.runtimeParamNames, rtParamName );
		}
	}

	public onTreeCompleted () {
		if ( this.parentScopeNode.isStrict )
			this.isStrict = true;
		else
			this.isStrict = this.checkScopeIsStrict ( this.body.body );

		var programNode = this.programNode;
		programNode.functionRegistry [this.funcNodeId] = this;
		this.programId = programNode.programId;
		this.fullName = this.scopeFullName + '.' + this.name;
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );

		if ( this.id )
			this.id.visitDepthFirst ( callback );

		RstNode.visitNodeArrayDepthFirst ( this.params, callback );
		this.body.visitDepthFirst ( callback );
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rIsExecuting] ) {	// Finished function body execution.
			var result = runtime.regs [this.rResult],
				callerNode = runtime.currentFrame.callerNode;

			runtime.regs [this.rIsExecuting] = false;
			runtime.exitFrame ();
			runtime.regs [callerNode.rResult] = result;
			runtime.nextNode = callerNode;
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		} else
			super.onStep ( runtime );
	}

	public initArgs ( runtime : Runtime, argsObj : IArguments ) {
		for ( var i = 0 ; i < this.params.length ; i++ ) {
			var param = this.params [i];
			runtime.defVar ( param.name, argsObj [i] );
		}
	}

	public enterFunctionScope ( runtime : Runtime, funcInstance : Function, thisObj : any,
		callerNode : RstNode, argsObj : IArguments )
	{
		/* TODO: when callerNode is null, it means that function invoked by native stack frame.
		 * Probably we should reflect this by adding intermediate stack frame labeled 'native'
		 * or by some other means. */
		var enclosingScope = <RuntimeScope> funcInstance ['enclosingScope'],
			funcScope = RuntimeScope.forkCurrent ( this.name, enclosingScope, thisObj ),
			callerFunc : Function;

		if ( runtime.currentFrame.isStrict )
			callerFunc = null;	// Do not reveal strict caller.
		else
			callerFunc = runtime.currentFrame.funcInstance;

		FunctionNode.pushCallData ( funcInstance, callerFunc, argsObj );
		runtime.enterFrame ( new StackFrame ( funcScope, this.name, funcInstance, callerNode, this.isStrict ) );

		if ( this.defFuncVarInBody )
			runtime.defVar ( this.name, funcInstance );

		this.initVars ( runtime );
		/* TODO: in non-strict mode arguments [i] aliases arg_i.
		 * UPD: this functionality considered unnecessary due to its minor use
		 * in real world and complexity of implementation.
		 * UPD: or maybe I'll implement this in future, ecma262 test inspects this functionality.
		 * UPD: still this feature seems to be doubtful and hard to implement. */
		runtime.defVar ( 'arguments', argsObj );
		this.initArgs ( runtime, argsObj );
		this.initFunctions ( runtime );
	}

	public setupInstance ( runtime : Runtime, funcInstance : Function, enclosingScope? : RuntimeScope ) {
		// TODO: secure these properties in future.
		Runtime.defineValue ( funcInstance, 'enclosingScope', enclosingScope || runtime.currentScope, false, false, false );
		Runtime.defineValue ( funcInstance, 'funcNodeId', this.funcNodeId, false, false, false );
		Runtime.defineValue ( funcInstance, 'programId', this.programId, false, false, false );
		// TODO: replace function toString () appearance with its original source code.

		return	funcInstance;
	}

	public createInstance ( runtime : Runtime, enclosingScope? : RuntimeScope ) {
		if ( this.factoryFunc === null ) {
			this.factoryFunc = new Runtime.builtin.Function ( 'rt',
				// TODO: include tough globals undef code.
				'return	' + this.generateFunctionCode () + ';'
			);
		}
		
		var funcInstance = <Function> this.factoryFunc ( runtime );
		this.setupInstance ( runtime, funcInstance, enclosingScope || runtime.currentScope );

		return	funcInstance;
	}

	private static createCallData ( caller : Function, args : IArguments ) {
		var callData = <FunctionCallData> Runtime.builtin.create ( null );
		callData.caller = caller;
		callData.arguments = args;

		return	callData;
	}

	public static pushCallData ( funcInstance : Function, caller : Function, args : IArguments ) {
		if ( !funcInstance ['callDataStack'] )
			funcInstance ['callDataStack'] = [];

		var callData = FunctionNode.createCallData ( caller, args );
		Runtime.builtin.push.call ( funcInstance ['callDataStack'], callData );
	}

	public static popCallData ( funcInstance : Function ) {
		var callDataStack = <FunctionCallData []> funcInstance ['callDataStack'];

		return	callDataStack.pop ();
	}

	public static getCallData ( funcInstance : Function ) {
		var callDataStack = <FunctionCallData []> funcInstance ['callDataStack'];

		if ( !callDataStack || callDataStack.length === 0 )
			return	FunctionNode.createCallData ( null, null );
		else
			return	callDataStack [callDataStack.length - 1];
	}

	public static getStrictness ( runtime : Runtime, funcInstance : Function ) {
		var funcNode = runtime.getFuncNode ( funcInstance, false );

		if ( funcNode ) {
			return	funcNode.isStrict ? FunctionStrictness.Strict : FunctionStrictness.NonStrict;
		} else
			return	FunctionStrictness.Unknown;
	}

	public static unbind ( funcInstance : Function, args : any [] ) {
		if ( funcInstance ['isBoundFunc'] ) {
			var data = <InvocationData> {
				args : args
			};

			do {
				data.thisObj = funcInstance ['boundThisArg'];
				data.args = funcInstance ['boundArguments'].concat ( data.args );
				funcInstance = funcInstance ['targetFunction'];
			} while ( funcInstance ['isBoundFunc'] );

			data.funcInstance = funcInstance;

			return	data;
		} else
			return	null;
	}

	public generateFunctionCode () : string {
		var code = 'function ' + this.name + ' (';
		code += Runtime.builtin.join.call ( this.runtimeParamNames, ', ' );
		code += ') {\n';

		if ( this.isStrict )
			code += '"use strict";\n';

		code += 'if ( rt.realGlobalObject !== rt.globalObject && this === rt.realGlobalObject ) {\n';
		code += 'return ' + this.name + '.apply ( rt.globalObject, arguments );\n';
		code += '}\n';
		code += 'rt.initFuncScope ( ' +
			this.name + ', ' +		// funcInstance
			'this, ' +				// thisObj
			'arguments' +			// argValues
			' );\n';
		
		code += 'try {\n';
		code += this.body.toCode () + '\n';
		code += '} finally { rt.exitFrame (); }\n';
		code += '}';	// End function.

		return	code;
	}

	public generateCreateFunctionCode () {
		var code = 'rt.setupFuncInstance ( ' +
			this.generateFunctionCode () + ', ' +	// funcInstance
			this.funcNodeId + ', ' +				// funcNodeId
			this.programId +						// programId
			' )';

		return	code;
	}
}