/// <reference path="System.ts" />
/// <reference path="rst/RstNode.ts" />
/// <reference path="rst/RstBuilder.ts" />
/// <reference path="RuntimeScope.ts" />
/// <reference path="StackFrame.ts" />
/// <reference path="syntax/parser/Parser.ts" />

// TODO: useless?
enum JumpDirection {
	None, Down, Up, Sibling, Unknown
}

interface ProgramCollection {
	[programId : number] : Program;
}

interface CalcUpdateResult {
	updatedValue : any;
	result : any;
}

/* TODO: all builtin functions used across Runtime class and all rst/*.ts classes
 * should be stored as static members of Runtime class.
 * Otherwise guest code can override them and break the runtime. 
 * UPD: implement script utilizing esprima to automatically search for those builtin calls. */
// TODO: make Function.prototype.call and Function.prototype.apply non-configurable and non-writable.
/* TODO: substitute Function.prototype.bind with own function that records boundFunction, boundArguments and boundThisObj.
 * Also make it non-configurable and non-writable. */
/* TODO: throughout all the code be careful to assign/read non-own properties of the objects:
 * indexes might be defined in guest code.
 * EXAMPLE:
	var userVar;
	Object.defineProperty ( Object.prototype, 'p', {
	  configurable : true,
	  enumerable : true,
	  set : function ( v ) { userVar = v; }
	} );
	var o = {};
	o.p = "this value will not be set to o.p";
	console.log ( userVar );
 * OUTPUT:
	"this value will not be set to o.p"
 * SOLUTION:
 *  Set prototypes of Runtime class constructors to null or Object.create ( null ).
 *  Use objects created only with Object.create ( null ).
 * TODO: what about arrays?
 * TODO: it's relatively easy to test the code for conformance, just define
 *  Object.defineProperty ( Object.prototype, '0' to 'N', { set : function ( v ) { throw 'gotcha!'; } } );
 *  and the same for getter.
 * SOLUTION FOR CLASSES:
	function Ctor () {
	  this.p = 15;
	}
	> undefined
	Ctor.prototype = Object.create ( null, { constructor : { configurable : true, enumerable : false, writable : true, value : Ctor } } )
	> Ctor {}
	var c = new Ctor ();
	> undefined
	c instanceof Ctor
	> true
	c
	> Ctor {p: 15}
 * TODO: be careful with overriden toString methods.
 * TODO: all static members should be initialized before guest code executed.
 * TODO: when looking for property of object, use 'p in o' rather that typeof o.p !== 'undefined'
 *  because 'in' operator doesn't bother itself by reading o.p value.
 * TODO: some of the functions throw when their arguments aren't boxed ( e.g. getOwnPropertyDescriptor,
 *  getPrototypeOf, hasOwnProperty, isExtensible, etc ). Find all of them and check whether their
 *  arguments properly boxed.
 * TODO: implement setTimeout, setInterval and setImmediate. Scan doc for similiar functions.
 * TODO: all files in rst/*.ts should begin with 'use strict', but not Runtime.ts.
 * TODO: make use of Object.freeze, Object.seal and Object.preventExtensions.
 *  - Invoke Object.freeze () on all enums.
 *  - Invoke Object.freeze () on Runtime.builtin.
 *  - Invoke Object.freeze () on Lexer.builtin.
 *  - Investigate other uses of these methods.
 * TODO: use 'in' operator carefully. It can always produce unnecessary 'true' result
 *  if left operand coerce to '__proto__'. Sometimes it's better to use hasOwnProperty
 *  because it reports false when its argument is '__proto__'.
 *  But note that in IE '({ '__proto__' : 'hehe' }).hasOwnProperty ( '__proto__' )' will return true!
 * TODO: use 'undefined !== ( v = o [p] )' carefully, 'o' always has '__proto__' member.
 * TODO: extract functions available to scope-control code from runtime to some object.
 *  Otherwise scope-control code has whole runtime instance available,
 *  which is potential threat.
 * TODO: use 'v === undefined' instead of 'typeof v === "undefined"' when appropriate.
 *  But remember that 'typeof neverDefinedVar' is ok even in strict mode.
 */
class Runtime {
	private parser : Parser;
	public realGlobalObject = window;
	public globalObject : any;
	public globalScope : RuntimeScope;
	public currentScope : RuntimeScope;
	public stack : StackFrame [];
	public currentFrame : StackFrame;
	public regs : any;
	public programs = <ProgramCollection> Runtime.builtin.create ( null );
	public programNode : Program = null;
	private currentNode : RstNode = null;
	public get isFinished () { return	this.currentNode === null; }
	public nextNode : RstNode = null;
	public lastJumpDirection : JumpDirection = JumpDirection.None;	// TODO: never read. Remove?
	public lr : any = undefined;	// TODO: implement.
	private evalFuncInstance : ( code : string ) => any = null;
	private funcCtorInstance : ( ...args : string [] ) => Function = null;
	private bindFuncInstance : ( thisArg : any ) => Function = null;
	private evalIsDirect = false;

	public static builtin = System.builtin.freeze ( {
		Array : Array,
		Boolean : Boolean,
		Date : Date,
		Error : Error,
		Function : Function,
		Number : Number,
		ObjectPrototype : Object.prototype,
		ObjectToString : Object.prototype.toString,
		ReferenceError : ReferenceError,
		String : String,
		SyntaxError : SyntaxError,
		TypeError : TypeError,
		/* TODO: is 'apply' used anywhere? Can it be used in conj. with 'call' at all?
		 * Make it non-configurate and non-writable as well as 'call'? */
		apply : Function.prototype.apply,
		bind : Function.prototype.bind,
		create : Object.create,
		defineProperties : Object.defineProperties,
		defineProperty : Object.defineProperty,
		freeze : Object.freeze,
		getOwnPropertyDescriptor : Object.getOwnPropertyDescriptor,
		getPrototypeOf : Object.getPrototypeOf,
		hasOwnProperty : Object.prototype.hasOwnProperty,
		indexOf : Array.prototype.indexOf,
		isExtensible : Object.isExtensible,
		join : Array.prototype.join,
		keys : Object.keys,
		pop : Array.prototype.pop,
		push : Array.prototype.push,
		slice : Array.prototype.slice,
		substr : String.prototype.substr,
		unshift : Array.prototype.unshift
	} );

	constructor ( globalObject : any ) {
		this.parser = new Parser ();
		this.globalObject = globalObject;
		this.globalScope = this.currentScope =
			RuntimeScope.fromObject ( 'Global', this.globalObject, this.globalObject );
		this.currentFrame = new StackFrame ( this.currentScope, 'initium' );
		this.stack = [this.currentFrame];
		this.regs = this.stack [0].registers;
	}

	public compile ( code : string, name : string, isStrict = false ) {
		var builder = new RstBuilder ( isStrict, name ),
			parseResult = this.parser.parse ( code, {
				loc : true,
				source : name,
				isStrict : isStrict,
				builder : builder
			} ),
			programNode = <Program> parseResult.ast;

		this.programs [programNode.programId] = programNode;

		return	programNode;
	}

	public setProgram ( programNode : Program ) {
		this.programNode = this.currentNode = programNode;
	}

	public run () {
		while ( !this.isFinished ) {
			// TODO: stop on breakpoint, DebuggerStatement.
			this.step ();
		}
	}

	public step () {
		if ( this.currentNode == null )
			return;

		this.nextNode = null;

		try {
			this.currentNode.step ( this );
		} catch ( exc ) {
			this.propagateException ( exc );
		}

		if ( this.regs [this.currentNode.rNodeState] === RstNodeState.Finished ) {
			this.regs [this.currentNode.rNodeState] = RstNodeState.NotInitialized;

			if ( this.nextNode == null )
				this.jump ( this.currentNode.parent );
			else
				this.jump ( this.nextNode );
		} else if ( this.nextNode != null )
			this.jump ( this.nextNode );
		else
			this.lastJumpDirection = JumpDirection.None;
	}

	// TODO: seems unnecessary.
	public jump ( nextNode : RstNode ) {
		if ( nextNode === this.currentNode )
			this.lastJumpDirection = JumpDirection.None;
		else if ( nextNode === this.currentNode.parent )
			this.lastJumpDirection = JumpDirection.Up;
		else if ( nextNode.parent === this.currentNode )
			this.lastJumpDirection = JumpDirection.Down;
		else if ( nextNode.parent === this.currentNode.parent )
			this.lastJumpDirection = JumpDirection.Sibling;
		else
			this.lastJumpDirection = JumpDirection.Unknown;

		this.currentNode = nextNode;
	}

	public runWithScopeControl () {
		var programFunc = this.programNode.createInstance ( this, this.globalObject );
		programFunc ();

		return	this.lr;
	}

	public enterFrame ( stackFrame : StackFrame ) {
		Runtime.builtin.push.call ( this.stack, stackFrame );
		this.currentFrame = stackFrame;
		this.currentScope = stackFrame.scope;
		this.regs = stackFrame.registers;
	}

	public exitFrame () {
		if ( this.stack.length === 1 )
			throw new Runtime.builtin.Error ( 'Can\'t exit from top level stack frame.' );
		
		var funcInstance = this.currentFrame.funcInstance;

		if ( funcInstance )
			FunctionNode.popCallData ( funcInstance );

		Runtime.builtin.pop.call ( this.stack );
		this.currentFrame = this.stack [this.stack.length - 1];
		this.currentScope = this.currentFrame.currentScope;
		this.regs = this.currentFrame.registers;
	}

	public enterSubScope ( name : string, scopeKind : ScopeKind ) {
		this.currentScope = this.currentFrame.currentScope = RuntimeScope.forkCurrent (
			name, this.currentScope, this.currentScope.thisObj
		);
		this.currentScope.kind = scopeKind;
	}

	public enterWithSubScope ( o : any ) {
		if ( o == null )
			throw new Runtime.builtin.TypeError ( o + ' has no properties' );

		o = Runtime.boxValue ( o );
		
		/* TODO: implement some more appropriate method of RuntimeScope that create
		 * sub scope with given object 'o' as its scope.vars. */
		this.currentScope = this.currentFrame.currentScope = RuntimeScope.forkCurrent (
			'with', this.currentScope, this.currentScope.thisObj
		);
		this.currentScope.vars = o;
		this.currentScope.kind = ScopeKind.WithStatement;
	}

	public exitSubScope () {
		if ( this.currentFrame.scope === this.currentFrame.currentScope ) {
			throw new Runtime.builtin.Error (
				'Can\'t exit from current scope because it\'s not subscope'
			);
		}

		this.currentScope = this.currentFrame.currentScope = this.currentScope.parent;
	}

	private lookupContainingScope ( name : string ) {
		if ( name === '__proto__' )
			return	null;

		var scope = this.currentScope;

		// Note: there is no collision with '__proto__'.
		while ( scope !== null && !( name in scope.vars ) ) {
			scope = scope.parent;
		}

		return	scope;
	}

	public getVar ( name : string, rScope? : number ) {
		name = Runtime.builtin.String ( name );
		var scope = this.lookupContainingScope ( name );

		if ( rScope !== undefined )
			this.regs [rScope] = scope;

		if ( scope === null )
			throw new Runtime.builtin.ReferenceError ( name + ' is not defined' );
		else
			return	this.readMember ( scope.vars, name );
	}

	/* TODO: this implementation doesn't have argument 'isStrict',
	 * therefore it can be used only when current frame is correct.
	 * Look every call site using this method, make sure current stack frame
	 * is correct for those calls. */
	public setVar ( name : string, value : any ) {
		name = Runtime.builtin.String ( name );
		var scope = this.lookupContainingScope ( name );

		if ( scope === null ) {
			if ( this.currentFrame.isStrict )
				throw new Runtime.builtin.ReferenceError ( name + ' is not defined' );
			else
				scope = this.globalScope;
		}

		return	this.writeMember ( scope.vars, name, value );
	}

	public assertCanDefFunc ( name : string ) {
		if ( name === '__proto__' )
			Runtime.throwIllegalIdentifier ( name );

		var vars = this.currentScope.vars,
			pd = Runtime.builtin.getOwnPropertyDescriptor ( vars, name );

		if ( pd && !pd.configurable && !pd.writable ) {
			throw new Runtime.builtin.TypeError (
				'function "' + name + '" has already been declared'
			);
		}
	}

	public defVar ( name : string, value : any, overrideExisting = true ) {
		name = Runtime.builtin.String ( name );

		if ( name === '__proto__' )
			Runtime.throwIllegalIdentifier ( name );

		var vars = this.currentScope.vars;

		if ( Runtime.builtin.hasOwnProperty.call ( vars, name ) ) {
			// Override only value, not configurability.
			if ( overrideExisting )
				this.writeMember ( vars, name, value );
		} else
			Runtime.defineValue ( vars, name, value, false, true, true );

		return	value;
	}

	public deleteVar ( name : string ) {
		name = Runtime.builtin.String ( name );

		var scope = this.lookupContainingScope ( name );

		if ( scope === null )
			return	true;
		else
			return	this.deleteMember ( scope.vars, name );
	}

	public typeofVar ( name : string ) {
		name = Runtime.builtin.String ( name );

		if ( name === '__proto__' )
			Runtime.throwIllegalIdentifier ( name );

		var scope = this.lookupContainingScope ( name );
		
		if ( scope === null )
			return	'undefined';
		else {
			var value = this.readMember ( scope.vars, name );

			return	typeof value;
		}
	}

	/* TODO: this implementation doesn't have argument 'isStrict',
	 * therefore it can be used only when current frame is correct.
	 * Look every call site using this method, make sure current stack frame
	 * is correct for those calls. */
	public updateVar ( name : string, operator : string, prefix : boolean ) {
		name = Runtime.builtin.String ( name );
		var scope = this.lookupContainingScope ( name );

		if ( scope === null )
			throw new Runtime.builtin.ReferenceError ( name + ' is not defined' );
		
		var value = this.readMember ( scope.vars, name ),
			updRes = Runtime.calcUpdate ( operator, value, prefix );

		this.writeMember ( scope.vars, name, updRes.updatedValue );

		return	updRes.result;
	}

	/* TODO: don't forget to override behavior of:
	 * - Object.getOwnPropertyDescriptor ()
	 * - Object.defineProperty ()
	 * - 'in' operator
	 * All of them must handle '__proto__' consistently across browsers.
	 */
	public readMember ( o : any, p : string, callerNode? : RstNode ) {
		p = Runtime.builtin.String ( p );
		var result : any = undefined;

		if ( typeof o === 'function' && ( p === 'caller' || p === 'arguments' ) ) {
			var funcInstance = <Function> o,
				isNonStrictUserFunc = FunctionNode.getStrictness ( this, funcInstance ) === FunctionStrictness.NonStrict;

			if ( isNonStrictUserFunc ) {
				var callData = FunctionNode.getCallData ( funcInstance );

				if ( p === 'caller' ) {
					result = callData.caller;

					if ( callerNode )
						this.regs [callerNode.rResult] = result;
				} else /*if ( p === 'arguments' )*/ {
					result = callData.arguments;

					if ( callerNode )
						this.regs [callerNode.rResult] = result;
				}

				return	result;
			}
		}

		if ( o == null ) {
			throw new Runtime.builtin.TypeError (
				'Cannot read property "' + p + '" of ' + o
			);
		} else if ( p === '__proto__' )
			Runtime.throwIllegalIdentifier ( p );
		else if ( callerNode ) {	// Transfer runtime control to accessor node.
			var pd = Runtime.getPropertyDescriptor ( o, p );

			if ( pd ) {
				if ( Runtime.builtin.hasOwnProperty.call ( pd, 'get' ) ) {
					var accessorFunc = <Function> pd.get;

					if ( accessorFunc ) {
						InvocationNode.makeInvocation (
							this,
							false,		// Not a 'new ctor (...)' call.
							callerNode,
							{
								funcInstance : accessorFunc,
								thisObj : o,
								args : []
							}
						);
					} else
						this.regs [callerNode.rResult] = undefined;
				} else	// Read data property.
					this.regs [callerNode.rResult] = pd.value;
			} else /*if ( !pd )*/
				this.regs [callerNode.rResult] = undefined;
		} else	// Access without transferring runtime control.
			result = o [p];

		return	result;
	}

	public writeMember ( o : any, p : string, v : any, callerNode? : RstNode ) {
		p = Runtime.builtin.String ( p );

		if ( o == null ) {
			throw new Runtime.builtin.TypeError (
				'Cannot set property "' + p + '" of ' + o
			);
		} else if ( p === '__proto__' )
			Runtime.throwIllegalIdentifier ( p );
		else {
			var pd = Runtime.getPropertyDescriptor ( o, p );

			if ( pd ) {
				if ( Runtime.builtin.hasOwnProperty.call ( pd, 'set' ) ) {
					var accessorFunc = <Function> pd.set;

					if ( accessorFunc ) {
						if ( callerNode ) {	// Transfer runtime control to accessor node.
							InvocationNode.makeInvocation (
								this,
								false,		// Not a 'new ctor (...)' call.
								callerNode,
								{
									funcInstance : accessorFunc,
									thisObj : o,
									args : [v]
								}
							);
						} else	// Access without transferring runtime control.
							o [p] = v;
					} else if ( this.currentFrame.isStrict ) {
						throw new Runtime.builtin.TypeError (
							'Cannot set property "' + p + '" of ' +
							Runtime.exceptionFreeToString ( o ) +
							' which has only a getter'
						);
					} else { /* no-op */ }
				} else if ( pd.writable ) {	// Set data property.
					/* Note: we're not checking for presence of 'writable' property as PropertyDescriptor
					 * always have either ('get' and 'set') or 'writable' own properties and we already
					 * assured in absence of 'get'/'set'. */
					o [p] = v;
				} else if ( this.currentFrame.isStrict ) {
					throw new Runtime.builtin.TypeError (
						'Cannot assign to read only property "' + p + '" of ' +
						Runtime.exceptionFreeToString ( o )
					);
				}
			} else /*if ( !pd )*/ {	// Create new property.
				if ( Runtime.builtin.isExtensible ( Runtime.boxValue ( o ) ) )
					o [p] = v;
				else if ( this.currentFrame.isStrict ) {
					throw new Runtime.builtin.TypeError (
						'Can\'t add property "' + p + '", object is not extensible'
					);
				}
			}
		}

		return	v;
	}

	public deleteMember ( o : any, p : string ) {
		p = Runtime.builtin.String ( p );

		if ( o == null ) {
			throw new Runtime.builtin.TypeError (
				'Cannot convert ' + o + ' to object'
			);
		} else if ( p === '__proto__' ) {
			// Act as if there was no such property.
			return	true;
		} else {
			var pd = Runtime.getPropertyDescriptor ( o, p );

			if ( pd ) {
				if ( pd.configurable )
					return	delete o [p];
				else {
					if ( this.currentFrame.isStrict ) {
						throw new Runtime.builtin.TypeError (
							'Cannot delete property "' + p + '" of ' +
							Runtime.exceptionFreeToString ( o )
						);
					} else
						return	false;
				}
			} else
				return	true;
		}
	}

	public validateCalleeObject ( o : any, p : string ) {
		CallExpression.validateCalleeObject ( o, p );
	}

	public callMethod ( o : any, p : string, args : any [] ) {
		/* Note: CallExpression.validateCalleeObject () is called
		 * earlier from generated code through rt.validateCalleeObject (). */
		p = Runtime.builtin.String ( p );
		CallExpression.verifyCalleeMethodExists ( o, p );
		var funcInstance = this.readMember ( o, p );
		CallExpression.validateCalleeMethod ( o, p, funcInstance );

		return	funcInstance.apply ( o, args );
	}

	public callFunction ( name : string, rScope : number, args : any [] ) {
		// Note: value of 'name' argument is always of string type.
		var funcInstance = this.getVar ( name, rScope ),
			varScope = <RuntimeScope> this.regs [rScope],
			thisObj = undefined;
		
		if ( varScope.kind === ScopeKind.WithStatement ) {
			CallExpression.validateCalleeMethod ( varScope, name, funcInstance );
			thisObj = varScope.vars;
		} else
			InvocationNode.verifyCalleeFunction ( funcInstance );

		return	funcInstance.apply ( thisObj, args );
	}

	private getProgramNode ( programId : number, throwIfMissing = true ) {
		var programNode = this.programs [programId];

		if ( throwIfMissing && typeof programNode === 'undefined' ) {
			throw new Runtime.builtin.ReferenceError (
				'Couldn\'t get program data by program id #' + programId
			);
		}

		return	programNode;
	}

	public getFuncNode ( funcInstance : Function, throwIfMissing = true ) {
		var programId = <number> funcInstance ['programId'],
			programNode = this.getProgramNode ( programId, false ),
			funcNodeId : number, funcNode : FunctionNode;
		
		if ( programNode ) {
			funcNodeId = funcInstance ['funcNodeId'];
			funcNode = programNode.functionRegistry [funcNodeId];
		}

		if ( throwIfMissing && typeof funcNode === 'undefined' ) {
			throw new Runtime.builtin.ReferenceError (
				'Couldn\'t get internal function data by program id #' + programId +
				' and function id #' + funcNodeId
			);
		}

		return	funcNode;
	}

	public initFuncScope ( funcInstance : Function, thisObj : any, argsObj : IArguments ) {
		var funcNode = this.getFuncNode ( funcInstance );
		funcNode.enterFunctionScope ( this, funcInstance, thisObj,
			null,	// callerNode. It is expected that initFuncScope () is called from native code.
			argsObj
		);
	}
	
	public initProgramScope ( programId : number ) {
		var programNode = this.getProgramNode ( programId );
		programNode.enterProgramScope ( this );
	}

	public setupFuncInstance ( funcInstance : Function, funcNodeId : number, programId : number ) {
		/* Partially setup function instance here and use it
		 * as a key to lookup corresponding function node. */
		funcInstance ['funcNodeId'] = funcNodeId;
		funcInstance ['programId'] = programId;
		var funcNode = this.getFuncNode ( funcInstance );

		return	funcNode.setupInstance ( this, funcInstance );
	}

	public createObj ( obj : any, getProps : GetPropertyAccessor [], setProps : SetPropertyAccessor [] ) {
		return	ObjectExpression.createObj ( obj, getProps, setProps );
	}

	public static calcBinOp ( operator : string, a : any, b : any ) {
		var r : any = undefined;

			 if ( operator === '+'   ) r = a + b;
		else if ( operator === '-'   ) r = a - b;
		else if ( operator === '*'   ) r = a * b;
		else if ( operator === '/'   ) r = a / b;
		else if ( operator === '%'   ) r = a % b;
		else if ( operator === '<<'  ) r = a << b;
		else if ( operator === '>>'  ) r = a >> b;
		else if ( operator === '>>>' ) r = a >>> b;
		else if ( operator === '&'   ) r = a & b;
		else if ( operator === '|'   ) r = a | b;
		else if ( operator === '^'   ) r = a ^ b;
		else if ( operator === '===' ) r = a === b;
		else if ( operator === '!==' ) r = a !== b;
		else if ( operator === '=='  ) r = a == b;
		else if ( operator === '!='  ) r = a != b;
		else if ( operator === '>='  ) r = a >= b;
		else if ( operator === '<='  ) r = a <= b;
		else if ( operator === '>'   ) r = a > b;
		else if ( operator === '<'   ) r = a < b;
		else if ( operator === 'in'  ) r = Runtime.calcInOp ( a, b );
		else if ( operator === 'instanceof' ) r = a instanceof b;
		else throw new Runtime.builtin.Error ( 'Invalid operation "' + operator + '"' );

		return	r;
	}

	public static calcInOp ( a : any, b : any ) {
		var aStr = Runtime.builtin.String ( a ),
			r = aStr in b;

		if ( r && aStr === '__proto__' ) {
			// '__proto__' never exists.
			r = false;
		}
		
		return	r;
	}

	// Make it available to scope-control code.
	public calcInOp = Runtime.calcInOp;

	public static calcUpdate ( operator : string, value : any, prefix : boolean ) {
		var res = <CalcUpdateResult> Runtime.builtin.create ( null );

			 if ( operator === '++' ) res.result = prefix ? ++value : value++;
		else if ( operator === '--' ) res.result = prefix ? --value : value--;
		else throw new Runtime.builtin.Error ( 'Invalid operation "' + operator + '"' );

		res.updatedValue = value;

		return	res;
	}

	public static exceptionFreeToString ( o : any ) {
		var str = '';

		try {
			str = Runtime.builtin.String ( o );
		} catch ( ex ) {
			str = Runtime.builtin.ObjectToString.call ( o );
		}

		return	str;
	}

	public propagateException ( exc : any ) {
		var node = this.currentNode;

		do {
			this.regs [node.rNodeState] = RstNodeState.NotInitialized;

			if ( node.parentProperty === 'finalizer' ) {	// Avoid executing finally clause twice.
				node = node.parent;	// TryStatement.
				this.regs [node.rNodeState] = RstNodeState.NotInitialized;
				node = node.parent;	// Parent of TryStatement.
			} else
				node = node.parent;

			if ( node !== null ) {
				if ( node.type === CatchClause.type ) {
					var catchNode = <CatchClause> node;
					catchNode.exitCatchScope ( this );
					this.regs [catchNode.rNodeState] = RstNodeState.NotInitialized;

					var tryNode = <TryStatement> node.parent;
					this.regs [tryNode.rState] = TryStatementState.EvalFinalizer;
					this.regs [tryNode.rException] = exc;
					this.regs [tryNode.rExceptionIsUnhandled] = true;
					this.nextNode = tryNode;
					break;
				} else if ( node.type === TryStatement.type ) {
					var tryNode = <TryStatement> node;
					this.regs [tryNode.rState] = TryStatementState.HandleException;
					this.regs [tryNode.rException] = exc;
					this.nextNode = tryNode;
					break;
				} else if ( node instanceof FunctionNode ) {
					/* TODO: review this. On which frame node state should be set to not initialized state?
					 * Should it be set to non-init on popped stack frame? */
					this.regs [node.rNodeState] = RstNodeState.NotInitialized;
					node = this.currentFrame.callerNode;
					this.exitFrame ();
				} else if ( node.type === Program.type ) {
					this.regs [node.rNodeState] = RstNodeState.NotInitialized;
					this.exitFrame ();
					this.regs [node.rNodeState] = RstNodeState.NotInitialized;
					node = this.currentFrame.callerNode;

					if ( node !== null ) {
						// Exit 'eval' stack frame pushed in Runtime.createEvalProgram ().
						this.exitFrame ();
					}
				} else if ( node.type === WithStatement.type ) {
					this.exitSubScope ();
				}
			}

			if ( node === null ) {
				/* TODO: implement more carefully.
				 * Make something like 'exception was unhandled' and field containing original exception.
				 * UPD: or throw original exception because wrapper exception seems to be useless.
				 * UPD: it's not useless since by using wrapper we can differ program exceptions
				 * from runtime internal exceptions.*/
				throw exc;
			}
		} while ( node !== null );
	}

	// TODO: rename to liftJump?
	public lift ( target : RstNode ) {
		var node = this.currentNode;

		while ( node !== target ) {
			if ( node.type === CatchClause.type ) {
				var catchNode = <CatchClause> node;
				catchNode.exitCatchScope ( this );
			} else if ( node.type === TryStatement.type ) {
				var tryNode = <TryStatement> node;
				this.regs [tryNode.rLiftTarget] = target;
				break;	// this.nextNode will be tryNode.
			} else if ( node.type === WithStatement.type ) {
				this.exitSubScope ();
			}

			this.regs [node.rNodeState] = RstNodeState.NotInitialized;

			if ( node.parentProperty === 'finalizer' ) {	// Avoid executing finally clause twice.
				node = node.parent;	// TryStatement.
				this.regs [node.rNodeState] = RstNodeState.NotInitialized;
				node = node.parent;	// Parent of TryStatement.
			} else
				node = node.parent;
		}

		this.nextNode = node;
	}

	/* TODO: distringuish direct eval and indirect eval as well as its strictness.
	 * NOTE: indirect evaluation ignores strictness of the caller and always sets thisObj to globalObject.
	 * NOTE: thisObj: same transformation rules as with invoked function, f.call ( this.currentScope.thisObj ).
	 * NOTE: direct eval: (((eval))) ('code'), indirect eval: (eval||0) ('code') or [eval][0] ('code')
	 */
	private createEvalProgram ( code : string, isDirect = true ) {
		var isStrict = isDirect ? this.currentFrame.isStrict : false,
			name = 'current-file.js:line:col',	// TODO: implement
			programNode = this.compile ( code, name, isStrict );

		var thisObj = this.currentScope.thisObj,
			evalScope = this.currentScope;

		if ( !isDirect ) {
			thisObj = this.globalScope.thisObj;
			evalScope = this.globalScope;
		} else if ( !programNode.isStrict ) {
			if ( thisObj == null )
				thisObj = this.globalScope.thisObj;
			else
				thisObj = Runtime.boxValue ( thisObj );
		}

		var evalScope = RuntimeScope.forkCurrent ( 'eval', evalScope, thisObj );
		evalScope.kind = ScopeKind.Eval;

		if ( !programNode.isStrict )
			evalScope.vars = evalScope.parent.vars;

		this.enterFrame ( new StackFrame (
			evalScope, 'eval',
			this.currentFrame.funcInstance,	// No extra function instance in stack data for eval.
			this.currentNode, isStrict
		) );
		
		return	programNode;
	}

	public evalCode ( code : string, isDirect : boolean ) {
		var programNode = this.createEvalProgram ( code, isDirect );
		this.nextNode = programNode;
	}

	public createEvalFuncInstance () {
		var rt = this,
			evalFuncImplementation = function ( code : string ) : any {
				var evalIsDirect = this.evalIsDirect;
				this.evalIsDirect = false;

				if ( this !== rt )
					throw new Runtime.builtin.TypeError ( 'function eval() { [native code] } is not a constructor' );
				
				if ( typeof code === 'string' ) {
					var programNode = rt.createEvalProgram ( code, evalIsDirect );

					try {
						var programFuncInstance = programNode.createInstance ( rt, rt.currentScope.thisObj );
						
						return	programFuncInstance ();
					} finally {
						// Exit 'eval' stack frame pushed in Runtime.createEvalProgram ().
						rt.exitFrame ();
					}
				} else
					return	code;
			};

		this.evalFuncInstance = Runtime.builtin.bind.call ( evalFuncImplementation, this );

		// TODO: override this.evalFuncInstance.toString ().
		this.evalFuncInstance ['isEvalFunc'] = true;

		return	this.evalFuncInstance;
	}

	public directEval ( code : string ) {
		/* Note: it doesn't matter that 'eval' might be property of
		 * some object. Consider:
		 * var o = { eval : eval }; with ( o ) { eval ( '...some code...' ); }
		 * still eval must be treated as function call, not method call. */
		var evalFunc = this.getVar ( 'eval' ),
			isDirectEval = evalFunc === this.evalFuncInstance;

		if ( isDirectEval ) {
			this.evalIsDirect = true;

			return	this.evalFuncInstance ( code );
		} else {
			var thisObj = this.currentFrame.isStrict ? undefined : this.globalObject;
			// TODO: what if evalFunc is null?
			return	evalFunc.apply ( thisObj, arguments );
		}
	}

	public createFuncCtorInstance () {
		var rt = this,
			funcCtorImplementation = function Function ( /*...param : string [], */ functionBody : string ) {
				/* Note: 'functionBody' parameter is just a dummy, don't rely on its value!
				 * Presence of this param just makes Function.length looking correct:
				 * Function.length === 1. */
				var params : any [] = Runtime.builtin.slice.call ( arguments, 0, arguments.length - 1 );

				/* Manually convert all params to string because 'join' converts
				 * null, undefined and etc values to empty string. */
				for ( var i = 0 ; i < params.length ; i++ ) {
					params [i] = Runtime.builtin.String ( params [i] );
				}

				var paramsCode = Runtime.builtin.join.call ( params, ',' ),
					bodyCode = arguments.length !== 0 ? Runtime.builtin.String ( arguments [arguments.length - 1] ) : '',
					funcCode = 'function anonymous(' + paramsCode + ') {\n' + bodyCode + '\n}',
					programNode = rt.compile ( funcCode, 'dynamic' );

				var funcNode = <FunctionDeclaration> programNode.body [0],
					userFuncInstance = funcNode.createInstance ( rt, rt.globalScope );

				return	userFuncInstance;
			};

		// TODO: it seems that binding is unnecessary. Just override toString ().
		//this.funcCtorInstance = <Function> Runtime.builtin.bind.call ( funcCtorImplementation, this );
		this.funcCtorInstance = funcCtorImplementation;
		this.funcCtorInstance.prototype = Runtime.builtin.Function.prototype;

		// Lock 'prototype' property.
		Runtime.defineValue ( this.funcCtorInstance, 'prototype',
			undefined,	// value
			undefined,	// configurable
			undefined,	// enumerable
			false		// writable
		);
		
		// NOTE: by unknown reason next line works in IE and doesn't works in Chrome.
		//this.funcCtorInstance.prototype ['constructor'] = this.funcCtorInstance;
		Runtime.builtin.Function.prototype ['constructor'] = this.funcCtorInstance;
		// TODO: check whether anyfunc instanceof this.funcCtorInstance works.

		// TODO: override this.funcCtorInstance.toString ().
		this.funcCtorInstance ['isFuncCtor'] = true;

		return	this.funcCtorInstance;
	}

	public createBindFuncInstance () {
		this.bindFuncInstance = function bind ( thisArg : any ) {
			var boundFunction = <Function> Runtime.builtin.bind.apply ( this, arguments ),
				frozenArgs = Runtime.builtin.freeze (
					Runtime.builtin.slice.call ( arguments, 1 )
				);

			Runtime.defineValue ( boundFunction, 'isBoundFunc', true, false, false, false );	// TODO: at least this one must be secured.
			Runtime.defineValue ( boundFunction, 'targetFunction', this, false, false, false );
			Runtime.defineValue ( boundFunction, 'boundThisArg', thisArg, false, false, false );
			Runtime.defineValue ( boundFunction, 'boundArguments', frozenArgs, false, false, false );

			return	boundFunction;
		};
		// TODO: override this.bindFuncInstance.toString ().

		return	this.bindFuncInstance;
	}

	public static defineValue ( o : any, p : string,
		value? : any,	// Optional, attributes can be changed without redefining value.
		configurable? : boolean,
		enumerable? : boolean,
		writable? : boolean )
	{
		var attrs = Runtime.builtin.create ( null );

		if ( typeof configurable !== 'undefined' )
			attrs.configurable = configurable;

		if ( typeof enumerable !== 'undefined' )
			attrs.enumerable = enumerable;

		if ( typeof value !== 'undefined' )
			attrs.value = value;

		if ( typeof writable !== 'undefined' )
			attrs.writable = writable;

		Runtime.builtin.defineProperty ( o, p, attrs );
	}

	public static defineGetter ( o : any, p : string,
		get? : () => any,	// Optional, attributes can be changed without redefining accessor.
		configurable? : boolean,
		enumerable? : boolean )
	{
		var attrs = Runtime.builtin.create ( null );

		if ( typeof configurable !== 'undefined' )
			attrs.configurable = configurable;

		if ( typeof enumerable !== 'undefined' )
			attrs.enumerable = enumerable;

		if ( typeof get !== 'undefined' )
			attrs.get = get;

		Runtime.builtin.defineProperty ( o, p, attrs );
	}

	public static defineSetter ( o : any, p : string,
		set? : ( v : any ) => void,	// Optional, attributes can be changed without redefining accessor.
		configurable? : boolean,
		enumerable? : boolean )
	{
		var attrs = Runtime.builtin.create ( null );

		/* TODO: reimplement undefined-checks,
		 * use direct comparison with undefined,
		 * don't query type of value.
		 * It's ok since nowadays undefined is
		 * non-configurable const.
		 * This TODO is solution-wide. */
		if ( typeof configurable !== 'undefined' )
			attrs.configurable = configurable;

		if ( typeof enumerable !== 'undefined' )
			attrs.enumerable = enumerable;

		if ( typeof set !== 'undefined' )
			attrs.set = set;

		Runtime.builtin.defineProperty ( o, p, attrs );
	}

	public static getPropertyDescriptor ( o : any, p : string ) {
		var pd : PropertyDescriptor;

		o = Runtime.boxValue ( o );

		do {
			pd = Runtime.builtin.getOwnPropertyDescriptor ( o, p );
		} while ( !pd && null !== ( o = Runtime.builtin.getPrototypeOf ( o ) ) );

		return	pd;
	}

	public static boxValue ( v : any ) {
		var typeofV = typeof v;

		if ( typeofV === 'number' )
			v = new Runtime.builtin.Number ( v );
		else if ( typeofV === 'boolean' )
			v = new Runtime.builtin.Boolean ( v );
		else if ( typeofV === 'string' )
			v = new Runtime.builtin.String ( v );

		return	v;
	}

	// Note: used in ForInStatement.toCode ().
	// TODO: make it static?
	// TODO: unused now. Remove.
	public throwReferenceError ( message : string ) {
		throw new Runtime.builtin.ReferenceError ( message );
	}

	public throwInvalidLHS ( contextDescription : string ) {
		throw new Runtime.builtin.ReferenceError (
			'Invalid left-hand side expression in ' +
			contextDescription
		);
	}

	public throwInvalidLHSInUpdate ( prefix : boolean ) {
		this.throwInvalidLHS ( ( prefix ? 'prefix' : 'postfix' ) + ' operation' );
	}

	public static throwIllegalIdentifier ( name : string ) {
		throw new Runtime.builtin.ReferenceError (
			'Illegal identifier name "' + name + '"'
		);
	}
}

System.breakPrototypeChain ( Runtime );