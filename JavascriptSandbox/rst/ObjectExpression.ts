/// <reference path="RstNode.ts" />

interface GetPropertyAccessor {
	key : string;
	func : () => any;
}

interface SetPropertyAccessor {
	key : string;
	func : ( v : any ) => void;
}

class ObjectExpression extends RstNode {
	public static get type () { return	'ObjectExpression'; }
	public properties : Property [];
	private getProperties : Property [] = [];
	private setProperties : Property [] = [];
	public isStrict = false;
	public precedence = 19;

	private rPropertyIdx : number;

	constructor ( properties : Property [] = [], loc? : SourceLocation ) {
		super ( loc );
		this.rPropertyIdx = RstNode.maxRegisterId++;
		this.linkChildren ( properties, 'properties' );
		
		for ( var i = 0 ; i < this.properties.length ; i++ ) {
			var propNode = this.properties [i],
				keyNode = propNode.key,
				key : string;

			if ( keyNode.type === Literal.type ) {
				var literalNode = <Literal> keyNode;
				key = Runtime.builtin.String ( literalNode.value );
			} else /*if ( keyNode.type === Identifier.type )*/ {
				var idNode = <Identifier> keyNode;
				key = idNode.name;
			}

			if ( key === '__proto__' )
				Runtime.throwIllegalIdentifier ( key );

			if ( propNode.kind === 'get' )
				Runtime.builtin.push.call ( this.getProperties, propNode );
			else if ( propNode.kind === 'set' )
				Runtime.builtin.push.call ( this.setProperties, propNode );
		}
	}

	public visitDepthFirst ( callback : VisitorCallback ) {
		callback ( this );
		RstNode.visitNodeArrayDepthFirst ( this.properties, callback );
	}

	public onEnter ( runtime : Runtime ) {
		runtime.regs [this.rPropertyIdx] = 0;
		runtime.regs [this.rResult] = {};
	}

	public onStep ( runtime : Runtime ) {
		var curIdx = runtime.regs [this.rPropertyIdx];

		if ( curIdx > 0 ) {
			var propIdx = curIdx - 1,
				obj = runtime.regs [this.rResult],
				prop = this.properties [propIdx],
				key = runtime.regs [prop.key.rResult],
				value = runtime.regs [prop.value.rResult];

			if ( prop.kind === 'init' )
				Runtime.defineValue ( obj, key, value, true, true, true );
			else if ( prop.kind === 'get' )
				Runtime.defineGetter ( obj, key, value, true, true );
			else if ( prop.kind === 'set' )
				Runtime.defineSetter ( obj, key, value, true, true );
		}

		if ( runtime.regs [this.rPropertyIdx] >= this.properties.length )
			runtime.regs [this.rNodeState] = RstNodeState.Finished;
		else
			runtime.nextNode = this.properties [runtime.regs [this.rPropertyIdx]++];
	}

	public static createObj ( obj : any, getProps : GetPropertyAccessor [], setProps : SetPropertyAccessor [] ) {
		for ( var i = 0 ; i < getProps.length ; i++ ) {
			var gpa = getProps [i];
			Runtime.defineGetter ( obj, gpa.key, gpa.func, true, true );
		}

		for ( var i = 0 ; i < setProps.length ; i++ ) {
			var spa = setProps [i];
			Runtime.defineSetter ( obj, spa.key, spa.func, true, true );
		}

		return	obj;
	}

	public toCode () {
		var pCode = [];

		for ( var i = 0 ; i < this.properties.length ; i++ ) {
			var prop = this.properties [i];
			
			if ( prop.kind === 'init' )
				Runtime.builtin.push.call ( pCode, prop.toCode () );
		}

		var code = '';

		if ( pCode.length )
			code = '{\n' + Runtime.builtin.join.call ( pCode, ',\n' ) + '\n}';
		else
			code = '{}';

		if ( this.getProperties.length || this.setProperties.length ) {
			var getPropsCode = this.genPropertiesCode ( this.getProperties ),
				setPropsCode = this.genPropertiesCode ( this.setProperties );

			code = 'rt.createObj ( ' + code;
			code += ', [' + Runtime.builtin.join.call ( getPropsCode, ', ' ) + ']';
			code += ', [' + Runtime.builtin.join.call ( setPropsCode, ', ' ) + '] )';
		}

		return	code;
	}

	private genPropertiesCode ( props : Property [] ) {
		var propsCode : string [] = [];

		for ( var i = 0 ; i < props.length ; i++ ) {
			var prop = props [i],
				key = prop.key,
				quotedKey : string,
				funcNode = <FunctionExpression> prop.value;

			if ( key.type === Literal.type )
				quotedKey = ( <Literal> key ).toQuotedString ();
			else /*if ( key.type === Identifier.type )*/
				quotedKey = ( <Identifier> key ).toQuotedString ();

			Runtime.builtin.push.call ( propsCode, '{ key : ' + quotedKey +
				', func : ' + funcNode.generateCreateFunctionCode () + '}' );
		}

		return	propsCode;
	}
}