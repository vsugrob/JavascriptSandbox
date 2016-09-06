/// <reference path="RstNode.ts" />

enum InvocationNodeState {
	EvalCallee = undefined,
	EvalArguments = 1,
	PrepareInvocation = 2,
	MakeInvocation = 3,
	GetResult = 4
}

interface InvocationData {
	funcInstance : Function;
	thisObj : any;
	args : any [];
}

class InvocationNode extends RstNode {
	public callee : RstNode;
	public arguments : RstNode [];

	public get isDirectEval () {
		var isDirect = false;

		if ( this.callee.type === Identifier.type ) {
			var idNode = <Identifier> this.callee;
			isDirect = idNode.name === 'eval';
		}

		return	isDirect;
	}

	public rState : number;
	public rArgumentIdx : number;
	public rInvocationData : number;	// Is to be set by inheritors.

	constructor ( callee : RstNode, args : RstNode [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rState = RstNode.maxRegisterId++;
		this.rArgumentIdx = RstNode.maxRegisterId++;
		this.rInvocationData = RstNode.maxRegisterId++;
		this.linkChild ( callee, 'callee' );
		this.linkChildren ( args, 'arguments' );
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		this.callee.visitDepthFirst ( callback );
		RstNode.visitNodeArrayDepthFirst ( this.arguments, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rArgumentIdx] = 0;
		runtime.regs [this.rState] = InvocationNodeState.EvalCallee;
	}

	public onStep ( runtime : Runtime ) {
		if ( runtime.regs [this.rState] === InvocationNodeState.EvalCallee ) {
			runtime.nextNode = this.callee;
			runtime.regs [this.rState] = InvocationNodeState.EvalArguments;
		} else if ( runtime.regs [this.rState] === InvocationNodeState.EvalArguments ) {
			var argIdx = runtime.regs [this.rArgumentIdx]++;

			if ( argIdx >= this.arguments.length )
				runtime.regs [this.rState] = InvocationNodeState.PrepareInvocation;
			else
				runtime.nextNode = this.arguments [argIdx];
		} else if ( runtime.regs [this.rState] === InvocationNodeState.PrepareInvocation ) {
			throw new Error (
				'InvocationNodeState.PrepareInvocation must be implemented by InvocationNode inheritors.'
			);
		} else if ( runtime.regs [this.rState] === InvocationNodeState.MakeInvocation ) {
			var args = [];

			for ( var i = 0 ; i < this.arguments.length ; i++ ) {
				var argNode = this.arguments [i];
				Runtime.builtin.push.call ( args, runtime.regs [argNode.rResult] );
			}

			runtime.regs [this.rState] = InvocationNodeState.GetResult;
			var invocationData = <InvocationData> runtime.regs [this.rInvocationData];
			invocationData.args = args;
			
			InvocationNode.makeInvocation ( runtime,
				this.type === NewExpression.type,
				this,
				invocationData
			);
		} else if ( runtime.regs [this.rState] === InvocationNodeState.GetResult ) {
			// Note: result of this node is set by callee.
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		}
	}

	public static makeInvocation ( runtime : Runtime, construct : boolean, callerNode : RstNode,
		invocationData : InvocationData )
	{
		var unboundData = FunctionNode.unbind ( invocationData.funcInstance, invocationData.args );

		if ( unboundData )
			invocationData = unboundData;

		var funcInstance = invocationData.funcInstance,
			thisObj = invocationData.thisObj,
			args = invocationData.args;

		// TODO: if ( funcInstance ['isCallFunc'] ) {
		// TODO: if ( funcInstance ['isApplyFunc'] ) {
		if ( funcInstance ['isEvalFunc'] ) {
			if ( construct )
				throw new Runtime.builtin.TypeError ( 'function eval() { [native code] } is not a constructor' );

			var code = args.length !== 0 ? args [0] : undefined;

			if ( typeof code === 'string' ) {
				var isDirectEval = false;

				if ( callerNode instanceof InvocationNode ) {
					var invocationNode = <InvocationNode> callerNode;
					isDirectEval = invocationNode.isDirectEval;
				}

				runtime.evalCode ( code, isDirectEval );
			} else
				runtime.regs [callerNode.rResult] = code;
		} else if ( funcInstance ['isFuncCtor'] ) {
			var userFuncInstance = funcInstance.apply ( null, args );
			runtime.regs [callerNode.rResult] = userFuncInstance;
		} else {
			var funcNode = runtime.getFuncNode ( funcInstance, false );

			if ( funcNode ) {
				var calleeStrictness = FunctionNode.getStrictness ( runtime, funcInstance );

				if ( construct ) {
					if ( callerNode.type === NewExpression.type ) {
						var newExpr = <NewExpression> callerNode;
						thisObj = newExpr.instantiate ( runtime, funcInstance );
					} else
						throw new SyntaxError ( '"new" operator cannot be applied to the specified caller.' );
				} else if ( calleeStrictness === FunctionStrictness.NonStrict ) {
					if ( thisObj == null )
						thisObj = runtime.globalScope.thisObj;
					else
						thisObj = Runtime.boxValue ( thisObj );
				}

				var calleeIsStrict = calleeStrictness === FunctionStrictness.Strict,
					argsObj = InvocationNode.toArgsObject ( calleeIsStrict, funcInstance, args );

				runtime.nextNode = funcNode.body;
				runtime.regs [funcNode.rResult] = undefined;
				funcNode.enterFunctionScope ( runtime, funcInstance, thisObj, callerNode, argsObj );
				runtime.regs [funcNode.rIsExecuting] = true;
			} else {
				var res : any;

				if ( construct )
					res = NewExpression.constructObject ( funcInstance, args );
				else
					res = funcInstance.apply ( thisObj, args );

				runtime.regs [callerNode.rResult] = res;
			}
		}
	}

	public static verifyCalleeFunction ( funcInstance : Function ) {
		var funcType = typeof funcInstance;

		if ( funcType !== 'function' )
			throw new Runtime.builtin.TypeError ( funcType + ' is not a function' );
	}

	private static constructNonStrictArgsObject () {
		return	arguments;
	}

	private static constructStrictArgsObject () {
		'use strict';

		return	arguments;
	}

	private static toArgsObject ( calleeIsStrict : boolean, funcInstance : Function, args : any [] ) {
		var argsObj : IArguments;

		if ( calleeIsStrict )
			argsObj = InvocationNode.constructStrictArgsObject.apply ( null, args );
		else {
			argsObj = InvocationNode.constructNonStrictArgsObject.apply ( null, args );
			argsObj.callee = funcInstance;
		}

		return	argsObj;
	}

	public generateArgumentListCode () {
		var aCode = [];

		for ( var i = 0 ; i < this.arguments.length ; i++ ) {
			var argument = this.arguments [i];
			Runtime.builtin.push.call ( aCode, this.embraceSequence ( argument ) );
		}

		if ( aCode.length )
			return	' ' + Runtime.builtin.join.call ( aCode, ', ' ) + ' ';
		else
			return	'';
	}
}