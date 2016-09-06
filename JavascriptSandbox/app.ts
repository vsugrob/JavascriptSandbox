/// <reference path="sandbox.ts" />
/// <reference path="WatchWidget.ts" />
/// <reference path="rst/RstNode.ts" />
/// <reference path="Ast.ts" />
/// <reference path="syntax/lexer/Lexer.ts" />
/// <reference path="syntax/parser/Parser.ts" />

var es = window ['esprima'];
var tokens = es.tokenize ( '{} /a/g;' );
/* Wow wow wow, esprima does wrong tokenization!
 * /a/g should be regex, but esprima thinks that it's a series of divisions. */

var code : string;
// Numeric literal:
//code = '123.4e2';
//code = '123.4e-2';
//code = '123.4e+2';
//code = '123.4e';
//code = '123.4ee';
//code = '017.4';
//code = '018.4';
//code = '018.4e1';
//code = '1.';
//code = '0.';
//code = '0';
//code = '0.5';
//code = '.1';
//code = '.';
//code = '1.e2';
//code = '.1e2';
//code = '0.1';
//code = '0e5';
//code = '0x1f';
//code = '0x1fA8D';
//code = '0x1fg';
//code = '07g';
//code = '0g';
//code = '1g';
//code = '1.2g';
//code = '0x';
//code = '0x1fe5';

// String literal:
//code = '""';
//code = '"abc"';
//code = '"a  b"';
//code = '"a\\r\\nb"';
//code = '"a';
//code = '"a\n';
//code = '"a\\"b"';
//code = '"a\\z"';
//code = '"a\\\nb"';
//code = '"a\\\r\nb"';
//code = '"a\\\u2028b"';
//code = '"a\u2028b"';
//code = '"a\\x42"';
//code = '"a\\x422"';
//code = '"a\\x4"';
//code = '"a\\x4g"';
//code = '"a\\xb"';
//code = '"a\\u0042"';
//code = '"a\\u00422"';
//code = '"a\\u004"';
//code = '"a\\u042"';
//code = '"a\\u004g"';
//code = '"a\\u"';
//code = '"\\0"';
//code = '"\\08"';
//code = '"\\0a"';
//code = '"\\07"';
//code = '"\\37"';
//code = '"\\101"';
//code = '"\\1011"';
//code = '"\\411"';

// Identifier:
//code = 'a';
//code = 'a1';
//code = '$';
//code = '_a';
//code = '1a';
//code = '@a';
//code = 'JS';
//code = 'бугога';
//code = '\\u0041\\u0042C';
//code = 'a\\u0062\\u0063';
//code = '\\x41B';
//code = '\\u123U';
//code = 'if';
//code = 'continued';

// Comments:
//code = '//abc';
//code = '//abc\\nefg';
//code = '//abc\nefg';
//code = '//abc\u2028efg';
//code = '/*abc*/efg';
//code = '/*abc\nefg*/hij';
//code = '/*abc';
//code = '/*abc\r\nefg*/hij';
//code = '/*abc***efg*/hij';
//code = '/**a/**/hij';

// Whitespace and line terminators:
//code = ' a';
//code = '     a';
//code = ' \ta';
//code = ' \t\v\fa';
//code = ' \ufeff\u2000a';
//code = '\na';
//code = '\r\na';
//code = '\u2029a';
//code = '\ra';
//code = ' \n \na';

// Regular expressions:
//code = '/a/';
//code = '/a\\n/';
//code = '/a\\/b/';
//code = '/a\\\\/g';
//code = '/a/gim';
//code = '/a/gg';
//code = '/a/gogi';
//code = '/a/gy';	// 'y' is Mozilla-only flag.
//code = '/a\n/';
//code = '/a[b]/';
//code = '/a[b/';
//code = '/[/]/';
//code = '/[]]/';
//code = '/[\\]/';
code = '/[\\]/]/';

// Punctuators:
//code = '{';
//code = '}';
//code = '(';
//code = ')';
//code = '[';
//code = ']';
//code = '.';
//code = ';';
//code = ',';
//code = '<';
//code = '>';
//code = '<=';
//code = '>=';
//code = '==';
//code = '!=';
//code = '===';
//code = '!==';
//code = '+';
//code = '-';
//code = '*';
//code = '%';
//code = '++';
//code = '--';
//code = '<<';
//code = '>>';
//code = '>>>';
//code = '&';
//code = '|';
//code = '^';
//code = '!';
//code = '~';
//code = '&&';
//code = '||';
//code = '?';
//code = ':';
//code = '=';
//code = '+=';
//code = '-=';
//code = '*=';
//code = '%=';
//code = '<<=';
//code = '>>=';
//code = '>>>=';
//code = '&=';
//code = '|=';
//code = '^=';
//code = '/';
//code = '/=';
//code = '@';
//code = '0+1';	// 0 shouldn't be considered as octal number.

var lex = new Lexer ();
lex.init ( code );
var tok = lex.read ();

//code = 'a+b*c';
//code = 'a+b*c/d';
//code = 'a+b*c+d';
//code = 'a=b';
//code = 'a.b';
//code = 'a.(b)';
//code = 'a=b=c';
//code = 'a+b=c';
//code = 'a ^ c || d';
//code = 'a + b;';	// TODO: currently ';' recognized as an EmptyStatement
//code = '++a * 5';
//code = 'a.b.c';
//code = 'a + b.c';
//code = 'a.b + c';
//code = 'a, b + c, d';
//code = 'a ? b + c : d';
//code = 'a + b ? c : d';
//code = 'a ? b ? c : d : e';
//code = 'a ["b"]';
//code = 'a.b ["c"]';
//code = 'a [b + c [d]]';
//code = 'a ( b, c )';
//code = 'a ()';
//code = 'z + a.b ( c, d + e )';
//code = '(a)';
//code = '(((a)))';
//code = '(a * (b - c))';
//code = '[a]';
//code = '[a,b]';
//code = '[]';
//code = '[,]';
//code = '[,,]';
//code = '[,a,]';
//code = 'new A';
//code = 'new A.B + c';
//code = 'new A ()';
//code = 'new A () ()';
//code = 'new A ( a, b )';
//code = 'new new A ( a ) ( b )';
//code = '({})';
//code = '({ a : 5 })';
//code = '({ a : 5, })';
//code = '({ a : 5, b : 6 })';
//code = '({ get name () {} })';
//code = '({ get "name" () {} })';
//code = '({ get 14 () {} })';
//code = '({ set age ( value ) {} })';
//code = '( function f ( a ) {} )';
//code = '( function f ( a, b ) {} )';
//code = '( function f () {} )';
//code = '( function () {} )';
//code = '( function break () {} )';
//code = '( function f ( continue ) {} )';
//code = '( function f ( + ) {} )';
//code = '( {} /a/g )';
//code = '( {} /=a/g )';
//code = '( {} + /a/g )';
//code = 'a++\nb';
//code = 'a.b++';
//code = 'a ()++';
//code = 'a + b++';
//code = '{ a = 5; }';
//code = ';';
//code = '';
//code = 'debugger\na';
//code = 'if ( a ) { b }';
//code = 'if ( a ) b';
//code = 'if () b';
//code = 'if ( a )';
//code = 'if ( a ) b; else c';
//code = 'if ( a ) b\nelse { c }';
//code = 'if ( a )\n\n\nb';
//code = 'while ( a ) { b = c; }';
//code = 'with ( o ) { p = 14; }';
//code = 'function f ( a, b ) { c = d; }';
//code = 'function f () {}';
//code = 'function () {}';
//code = 'for (;;) a;';
//code = 'for ( a = 14 ; a < 28 ; a++ ) b += a;';
//code = 'for ( ; a < 28 ; a++ ) b += a;';
//code = 'for ( ; ; a++ ) b += a;';
//code = 'for ( a in b );';
//code = 'for ( i = 14 + /in/g ; false ; );';
//code = 'for ( r = "p" in {} ; false ; );';
//code = 'for ( r = ("p" in {}) ; false ; );';
//code = 'for ( var a in b );';
//code = 'for ( let a in b );';
//code = 'for ( const a in b );';
//code = 'for ( var a, b in c );';
//code = 'for ( var a = 42 in b );';
//code = 'for ( var a = 42, b in c );';
//code = 'var a';
//code = 'var a = 5;';
//code = 'var a, b';
//code = 'var a = 5, b';
//code = 'let a, b\nc';
//code = 'do a++\nwhile ( a < 5 )';
//code = 'do a++ while ( a < 42 )';
//code = 'do a++; while ( a < 42 ); b';
//code = 'do a++; while ( a < 42 )\nb';
//code = 'return';
//code = 'function f () { return }';
//code = 'function f () { return 14; }';
//code = 'function f () { return\n14; }';
//code = 'throw';
//code = 'throw a';
//code = 'throw a\nb';
//code = 'throw a;b';
//code = 'try {} catch ( e ) {}';
//code = 'try {} finally {}';
//code = 'try {} catch ( e ) {} finally {}';
//code = 'try {}';
//code = 'try {} finally {} catch ( e ) {}';
//code = 'try {} catch ( var e ) {}';
//code = 'try a; catch ( e ) {}';
//code = 'try {} catch {}';
//code = 'switch ( a ) {}';
//code = 'switch ( a ) { case b: }';
//code = 'switch ( a ) { case b: c; case d: e }';
//code = 'switch ( a ) { default: }';
//code = 'switch ( a ) { case b: c; default: d }';
//code = 'switch ( a ) { case b: c; default: d; default: e; }';
//code = 'switch ( a ) { case b: c\ncase d: e }';
//code = 'label : a';
//code = 'label : while ( true ) {}';
//code = 'labelA : labelB : while ( true ) {}';
//code = 'label : label : a';
//code = 'break';
//code = 'while ( true ) break';
//code = 'while ( true ) break label';
//code = 'label : break label';
//code = 'label : break\nlabel';
//code = 'label : break';
//code = 'label : function f () { break label; }';
//code = 'continue';
//code = 'while ( true ) continue';
//code = 'continue label';
//code = 'label : continue label';
//code = 'label : while ( true ) continue';
//code = 'label : while ( true ) continue label';
//code = 'labelA : labelB : while ( true ) continue labelA';
//code = 'label : function f () { while ( true ) continue label }';
//code = '"use strict"; "\\101bugoga"';
//code = '"\\101bugoga"; "use strict"';
//code = '"\\101bugoga"; 14; "use strict"';
//code = '"use strict" + 14; "\\101bugoga"';
//code = '"use\\x0020strict"; "\\101bugoga"';
//code = '"use strict"; private = 14;';
//code = '"use strict"; 0123;';
//code = '"use strict"; ({ a : 5, a : 6 })';
//code = '"use strict"; ({ a : 5, "a" : 6 })';
//code = '"use strict"; ({ a : 5, get a () {} })';
//code = '"use strict"; ({ get a () {}, set a () {} })';
//code = '"use strict"; ({ get a () {}, get "a" () {} })';
//code = '{ "use strict"; 0123; }';
//code = 'function f () { "use strict"; 0123; }';
//code = 'function private () { "use strict" }';
//code = 'function f ( private ) { "use strict" }';
//code = 'function f ( a, a ) { "use strict" }';
//code = '"use strict"; function f ( private ) {}';
//code = '"use strict"; a.private = 14';
//code = '"use strict"; with ( o ) {}';
//code = '"use strict"; var eval = 14;';
//code = '"use strict"; function eval () {}';
//code = '"use strict"; function f ( arguments ) {}';
//code = '"use strict"; try {} catch ( arguments ) {}';
//code = '"use strict"; function f () {}';
//code = '"use strict"; { function f () {} }';
//code = '"use strict"; function f () { function g () {} }';
//code = '"use strict"; function f () { l : function g () {} }';
//code = '"use strict"; delete a';
//code = '"use strict"; delete a + b';
//code = '"use strict"; delete a [b]';
//code = '"use strict"; delete [a]';	// TODO: fix.
//code = '"use strict"; delete a++';
//code = '"use strict"; delete (((a)))';
//code = '"use strict"; delete (((a))).b';
//code = '"use strict"; delete a.b';
//code = '"use strict"; ++eval';
//code = '"use strict"; ++(eval)';
//code = '"use strict"; ++(eval) + 5';
//code = '"use strict"; ++(eval) (5)';
//code = '"use strict"; ++eval.count';
//code = '"use strict"; eval++';
//code = '"use strict"; (eval)++';
//code = '"use strict"; 5 + (eval)++';
//code = '"use strict"; eval.count++';
//code = '"use strict"; a + b * eval++';
//code = '"use strict"; arguments = 14';
//code = '"use strict"; a = arguments = 14';
//code = '"use strict"; a + arguments = 14';
//code = '"use strict"; a.arguments = 14';
//code = '"use strict"; arguments += 14';
//code = 'a // comment1\nb// comment2';
//code = 'a /*comment*/ + b /*line1\nline2*/ * c //trailing comment';
//code = '// solitary comment';
//code = '/* solitary block comment */';
//code = 'a + b /* unfinished block comment';
//code = '/a/\\u0067';
//code = '\\u0076\\u0061\\u0072 a = 5';
//code = 'a\\';
//code = '1 ? 2, 3 : 4';
//code = '({ p : a ? b : c, q : 14 })';
//code = 'var dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1);';
//code = 'a\n++b';
code = 'var a=5,b;';

var par = new Parser (),
	parseRes = par.parse ( code, { collectComments : true, source : 'test.js' } );

//"use strict";
var esprima = window ['esprima'],
	escodegen = window ['escodegen'],
	CodeMirror = window ['CodeMirror'];

var rstTimeElapsed = 0,
	scopeControlTimeElapsed = 0;

function rstDev ( code : string ) {
	var globalObject = {
			Math : Math,
			Array : Array,
			Date : Date,
			Object : Object,
			console : console,
			eval : <( code : string ) => any> undefined,
			Function : <( ...args : string [] ) => Function> undefined
		},
		runtime = new Runtime ( globalObject ),
		programNode = runtime.compile ( code, 'main' ),
		timeStart : number, timeEnd : number;

	globalObject.eval = runtime.createEvalFuncInstance ();
	globalObject.Function = runtime.createFuncCtorInstance ();
	globalObject.Function.prototype.bind = runtime.createBindFuncInstance ();

	runtime.setProgram ( programNode );

	var o = { p : { q : 33 } };
	Object.defineProperty ( o, 'nonConfigurableProperty', { configurable : false, enumerable : true, value : 14 } );
	runtime.globalObject.o = o;

	if ( true ) {
		timeStart = Date.now ();

		runtime.run ();

		timeEnd = Date.now ();
		rstTimeElapsed = ( timeEnd - timeStart ) / 1000;

		console.log ( 'Rst execution took ' + rstTimeElapsed + 'sec' );
	}

	if ( false ) {
		timeStart = Date.now ();

		runtime.runWithScopeControl ();

		timeEnd = Date.now ();
		scopeControlTimeElapsed = ( timeEnd - timeStart ) / 1000;

		console.log ( 'Scope control execution took ' + scopeControlTimeElapsed + 'sec' );
	}
}

function rstTest () {
	var code;
	//code = 'var a = 2, b = 6; /*a = 4;*/ /*o.p = 14;*/ a = o.p.q;';
	//code = 'a = 5;';	// Identifier assignment
	//code = 'o.p = "bugoga";';	// Member assignment
	//code = 'var a = 7; a += 5;';	// Identifier compound assignment
	//code = 'o.p.q += 77;';	// Member compound assignment
	//code = 'var k = "name"; o.p [k] = "Alena";';	// Computed Member assignment
	//code = 'a = b = 7;';
	//code = 'var a = 7; a++; a--; ++a; --a;';
	//code = 'o.p.q++; o.p.q--; ++o.p.q; --o.p.q;';
	//code = 'a = 2 * 4;';
	//code = 'a = 2 * 4 % 6 + 7 << 2 | 5;';
	//code = 'a = "" && false;';	// Should return ''
	//code = 'a = "s" && false;';	// Should return false
	//code = 'a = "s" || true;';	// Should return 's'
	//code = 'a = "" || 123;';	// Should return 123
	//code = 'a = ( "s", true );';
	//code = 'a = -14;';
	//code = 'a = typeof "bugoga";';
	//code = 'a = void "bugoga";';
	//code = 'a = [1, "hehe", true];';
	//code = 'a = delete o.p;';	// Should return true
	//code = 'a = delete o.nonConfigurableProperty;';	// Should return false
	//code = 'a = 14; b = delete a;';	// Should return true
	//code = 'var a = 14; b = delete a;';	// Should return false.
	//code = 'a = delete (1234 + "bugoga");';	// Should return true.
	//code = 'person = { name : "Alena", age : 21, appearance : { kind : "Beauty" } };';
	//code = '{ var a = 14; }';
	//code = 'var i = 0; do i++\nwhile ( i < 3 );';
	//code = 'var i = 0, s = ""; do { s += i + ", "; } while ( ++i < 3 );';
	//code = 'var i = 0; while ( ++i < 2 ) { "a"; }';
	//code = 'var i = 0; while ( ++i < 3 ) { while ( true ) { break; } }';
	//code = 'var i = 0; lbl: { i = 1; break lbl; i = 2; }';	// i should contain 1
	//code = 'lbl: { continue lbl; }';	// Should throw SyntaxError
	//code = 'var i = 0, j = 0; while ( i++ < 3 ) { continue; j++; }';	// i = 4, j = 0
	//code = 'var i = 0, j = 0; lbl: while ( i++ < 3 ) { continue lbl; j++; }';	// i = 4, j = 0
	//code = 'var i = 0, j = 0; lbl: lbl2: while ( i++ < 3 ) { continue lbl; j++; }';	// i = 4, j = 0
	//code = 'var i = 0, j = 0; lbl: while ( i++ < 3 ) { while ( true ) { continue lbl; } j++; }';	// i = 4, j = 0
	//code = ';';
	//code = 'var j = 0; for ( var i = 0 ; i < 5 ; i++ ) { j += i; }';	// j = 10
	//code = 'var keys = ""; for ( var k in [1, 2] ) { keys += k + ", " };';
	//code = 'var keys = ""; for ( k in [1, 2] ) { keys += k + ", " };';
	//code = 'var keys = "", o = {}; for ( o.p in [1, 2] ) { keys += o.p + ", " };';
	//code = 'var arr = [], i = 0; for ( arr [i++] in [1, 2] ) {};';
	//code = 'var keys = ""; for ( var k in "ab" ) { keys += k + ", " };';
	//code = 'var a = 0; if ( true ) { a = 1; }';
	//code = 'var a = 0; if ( false ) { a = 1; }';
	//code = 'var a = 0, b = 0; if ( true ) { a = 1; } else b = 1;';
	//code = 'var a = 0, b = 0; if ( false ) { a = 1; } else b = 1;';
	//code = 'var a = true ? 1 : 0;';
	//code = 'var a = false ? 1 : 0;';
	//code = 'switch ( 3 ) { default: a = true; case 0: b = true; break; case 1: c = true; case 2: d = true; break; }';
	//code = 'var a = "a b c".split ( " " );';
	//code = 'var a = Math.cos ( Math.PI );';
	//code = 'var a = ""; function f () { af (); } var af = function anonFunc () { a = "af () called"; }; f ();';
	//code = 'var a = ""; function f () { return	10 + 4; } a = f ();';
	//code = 'var a = ""; function f () { var privateVar = 14; return	function () { return privateVar; } }; f2 = f (); a = f2 ();';
	//code = 'function f () { var fVar = 14; return function g () { return fVar++; }; } var g1 = f (); var g1Res = g1 (); g1Res = g1 (); var g2 = f (); var g2Res = g2 ();';
	//code = 'var a = ( function ( a, b, c ) { return arguments.length; } ) ( 1, 2, 3 );';
	//code = 'function factorial ( n ) { if ( n === 1 ) return 1; else return n * factorial ( n - 1 ); } var a = factorial ( 5 );';
	//code = 'var f = function factorial ( n ) { if ( n === 1 ) return 1; else return n * factorial ( n - 1 ); }; var a = f ( 5 );';
	//code = 'function Vec2 ( x, y ) { this.x = x | 0; this.y = y | 0; } var v1 = new Vec2 ( 1, 2 ); var a = v1 instanceof Vec2;';
	//code = 'var arr = new Array (); var ass = Array.isArray ( arr );';	// TODO: fix this. Currently ass = false. // UPD: FIXED.
	//code = 'var a; throw "hehe"; a = true;';	// a = undefined
	//code = 'var a, b; try { throw "hehe"; } catch ( exc ) { a = exc; } finally { b = true; }';
	//code = 'var a, b, exc = "orig value"; try { throw "hehe"; } catch ( exc ) { a = exc; } finally { b = true; }';
	//code = 'var a, b; function f () { throw "hehe"; } try { f (); } catch ( exc ) { a = exc; } finally { b = true; }';
	//code = 'var a, b, exc = "orig value"; function f () { try { throw "hehe"; } catch ( exc ) { a = exc; } finally { b = true; } } f ();';
	//code = 'var a; try {} finally { a = true; }';
	//code = 'var a; try {} finally { throw "hehe"; }';
	//code = 'var a; try { try {} finally { throw "hehe"; } } catch ( exc ) { a = exc; }';
	//code = 'var a; try { throw "hoho"; } catch ( exc ) { throw "hehe"; } a = true';
	//code = 'var a; try { try { throw "hoho"; } catch ( exc1 ) { throw "hehe"; } } catch ( exc2 ) { a = exc2; }';
	//code = 'var a; function f () { try { try { return 14; } finally { throw "hehe"; } } catch ( ex ) {} return 15; } a = f ();';	// a = 15
	//code = 'var a; function f () { try { return 14; } finally { lbl: { try { throw "hehe"; } catch ( ex1 ) { break lbl; } } } return 15; } a = f ();';	// a = 14;
	//code = 'var a; function f () { try { throw "hehe"; } finally { return 14; } return 15; } a = f ();';	// a = 14
	//code = 'var a; function f () { l0: { try { throw "hehe"; } finally { break l0; } } return 15; } a = f ();';	// a = 15
	//code = 'var a; function f () { try { throw "hehe"; } catch ( ex ) { return 16; } finally { return 14; } return 15; } a = f ();';	// a = 14;
	//code = 'var o = { a : 14, get p () { return this.a; }, set p ( v ) { return this.a = v; } }; var pv = o.p; o.p = pv + "hehe"; var res = o.a === "14hehe";';
	//code = 'var age = 21, o = { name : "Alena", toString : function () { return this.name + " " + age; } }, s = o + "";';
	//code = 'var test7_3_1\u2028prop = 66;';
	//code = 'function f () {} var func = function f () {};';
	//code = '"use strict"; function f () {} try { throw "hehe"; } catch ( ex ) { f (); ex = 5; }';
	//code = 'eval ( "var a = \'this value came from evaluated code.\';" ); var b = a;';
	//code = 'var a = eval ( 14 );';	// a = 14, non-string argument passed to eval should be returned without evaluation.
	//code = 'eval ( "function f () { return 14; }" ); function f () { return 86; } var a = f ();';	// a = 14
	//code = 'var a = 14; eval ( "\'use strict\'; var a = 86;" ); var b = a;';	// b = 14
	//code = 'var o1 = { a : 5, f : function () { \'use strict\'; var o2 = { ev : eval }; o2.ev ( \'this.a = 14\' ); } }; o1.f ();';	// globalObject.a = 14, o1.a = 5
	//code = 'var a; eval ( "throw \'hehe\';" ); a = 5;';	// a = undefined
	//code = '"use strict"; ( function () { eval ( "fVar = 14;" ); } ) ();';	// Should throw ReferenceError
	//code = '"use strict"; eval ( "delete RegExp;" );';
	//code = 'var f = new Function ( "return 14;" ); var a = f ();';
	//code = 'function fStrict () { "use strict"; return this; } var a = fStrict ();';	// a = undefined.
	//code = 'function fNonStrict () { return this; } var a = fNonStrict ();';	// a = <global object>.
	//code = "new eval ( 'var a = 14;' );";	// should throw
	//code = '1; if ( false ) 2;';	// runtime.lr = 1
	//code = '14; if ( true );';		// runtime.lr = 14
	//code = 'var a = eval ( "14;" );';	// a = 14

	//code = 'var d = new Date ();';
	//code = 'var d = new Date ( 1369227581987 );';
	//code = 'var d = new Date ( "February 16, 1992 21:30:16" );';
	//code = 'var d = new Date ( 1992, 1, 16 );';
	//code = 'var d = new Date ( 1992, 1, 16, 21 );';
	//code = 'var d = new Date ( 1992, 1, 16, 21, 30 );';
	//code = 'var d = new Date ( 1992, 1, 16, 21, 30, 16 );';
	//code = 'var d = new Date ( 1992, 1, 16, 21, 30, 16, 123 );';
	//code = 'var juneDate = new Date(2000, 5, 20, 0, 0, 0, 0); var juneOffset = juneDate.getTimezoneOffset();';

	//code = 'eval ( "var regExp = /[\\u2028]/" );';	// should throw
	//code = 'eval ( "var regExp = /[\\u2029]/" );';	// should throw
	//code = '"\\u000G"';	// should throw
	//code = '"\\u1"';		// should throw
	//code = 'var re = //; var hehe;';	// should throw. TODO: throws here, but not in a test262.
	//code = 'var a, p = 77, o = { p : 14, f : function () { eval ( "a = this.p;" ); } }; o.f ();';	// a = 14, direct eval.
	//code = 'var a, p = 14, o = { p : 77, f : function () { var evil = eval; evil ( "a = this.p;" ); } }; o.f ();';	// a = 14, indirect eval.
	//code = 'var a = []';	// a.length = 0
	//code = 'var a = [,]';	// a.length = 1
	//code = 'var a = [1,2,]';	// a.length = 2
	//code = 'var a = [1,2,,]';	// a.length = 3

	//code = 'var a = 5; 42 = 42';	// a = 5 and then ReferenceError
	//code = 'var a = 5; 1--;'	// a = 5 and then ReferenceError: Invalid left-hand side expression in postfix operation
	//code = 'var a = 5; for ( 1 + 1 in [1] ) {}';	// a = 5 and then ReferenceError: Invalid left-hand side in for-in.
	//code = 'var o = { valueOf : function () { throw "hehe"; } }; o++;';	// throw
	//code = 'var o = { valueOf : function () { return 1; } }, a = o++;';	// a = 1, o = 2

	//code = 'function f ( x, y ) { return this.v + x + y; } var bf = f.bind ( { v : 7 }, 4 ), a = bf ( 3 );';	// a = 14
	//code = 'var d = new Date ( 1992, 1, 16 );';	// d = date object 1992, 2, 16
	//code = 'var db = Date.bind ( null, 1992, 1 ), d = new db ( 16 );';	// db = date object 1992, 2, 16
	//code = 'function Vec2 ( x, y ) { this.x = x | 0; this.y = y | 0; } var v = new Vec2 ( 1, 4 );';	// v = Vec2 object { x : 1, y : 4 }
	//code = 'function f ( y, z, w ) { return this.x + y + z + w; } var bf1 = f.bind ( { x : 3 }, 4 ), bf2 = bf1.bind ( { x : 77 }, 5 ), a = bf2 ( 2 );';	// a = 14

	//code = 'try {} catch("22") {}';	// should throw

	/* TODO: test new implementation of member expression in:
	 * - AssignmentExpression.
	 * - ForInStatement.
	 * - UpdateExpression.
	 * - UnaryExpression.
	 * - CallExpression.
	 * - Places where member expression is at right hand side.
	 * Test new implementation of InvocationNode, CallExpression, NewExpression. */
	// TODO: write code generation corresponding to new implementation of member expression.
	//code = 'var o = { p : 77 }; o.p = 14;';	// o.p = 14
	//code = 'var o = { p : 7 }; o.p += 7;';	// o.p = 14
	//code = 'var o = { p : 14 }; for ( o.p in [0, 1] ) {};';	// o.p = 1
	//code = 'var o = { p : 15 }; o.p--;';		// o.p = 14
	//code = 'var o = { p : -14 }, a = -o.p;';	// a = 14
	//code = 'var o = { p : 77 }, a = delete o.p;';	// a = true, o.p should be deleted
	//code = '(null)(14);';	// should throw
	//code = 'var o = {}; o.bugoga ();';	// should throw
	//code = 'var o = { getName : function () { return "Alena"; } }, a = o.getName ();';	// a = "Alena"
	//code = 'var o = { p : 14 }, a = o.p;';	// a = 14
	//code = 'var o = Object.defineProperty ( { v : 14 }, "p", { get : function () { return this.v; } } ), a = o.p;';	// a = 14

	//code = 'var o = { p : 77 }; o.p = 14;';	// o.p = 14
	//code = 'var o = {}; o.p = 14;';	// o.p = 14
	//code = 'var o = Object.defineProperty ( {}, "p", { get : function () { return 14; } } ); o.p = 77;';	// should not throw
	//code = '"use strict"; var o = Object.defineProperty ( {}, "p", { get : function () { return 14; } } ); o.p = 77;';	// should throw
	//code = 'var o = Object.defineProperty ( { v : 77 }, "p", { set : function ( v ) { this.v = v; } } ); o.p = 14;';	// o.v = 14
	
	//code = 'function f () { return f.arguments; } var a = f ( 1, 2 );';	// a = Arguments [1, 2];
	//code = 'function f () { "use strict"; return f.arguments; } var a = f ( 1, 2 );';	// should throw
	//code = 'function f () { return f.caller; } var a = f ();';	// a = null
	//code = 'function f () {} var a = f.caller; ';	// a = null
	//code = 'function f () { return f.caller; } function g () { return f (); } var a = g () === g;';	// a = true
	//code = "function fdump ( label, f ) { console.log ( label + ': caller: ' + f.caller + ', arguments: ' + ( f.arguments ? Array.prototype.slice.call ( f.arguments ) : 'null' ) ); }" +
	//		"function f ( i ) { fdump ( '#1', f ); if ( i > 0 ) { g ( i - 1 ); } fdump ( '#2', f ); }" +
	//		"function g ( i ) { f ( i ); }" +
	//		"function main () { f ( 1 ); } main ();";
	///* Expected output is like:
	//	#1: caller: function main() { f ( 1 ); }, arguments: 1
	//	#1: caller: function g( i ) { f ( i ); }, arguments: 0
	//	#2: caller: function g( i ) { f ( i ); }, arguments: 0
	//	#2: caller: function main() { f ( 1 ); }, arguments: 1
	// */
	/* NOTE: result of the following test differs from IE/FF results!
	 * IE/FF: o.tsCaller = null
	 * Chrome: same results as ours: o.tsCaller = function f. */
	//code = "var o = { toString : function ts () { this.tsCaller = ts.caller; } }; function f () { return o + ''; }; f ();";
	//code = "function f () { return eval ( 'function g () { return g.caller; } g ();' ); } var a = f ();";	// a = function f

	//code = 'var o = { p : 14 }, p = 15, a; with ( o ) { a = p; }';	// a = 14
	//code = 'var o = { p : 14 }, p = 15, a; if ( true ) with ( o ) a = p;';	// a = 14, code generation correctness check
	//code = 'var o = { p : 14 }, p = 15, a; with ( o ) { a = delete p; }';	// a = true, o.p should be deleted
	//code = 'var o = { v : 77, f : function () { this.v = 14; } }; with ( o ) { f (); }';	// o.v = 14
	//code = 'var o = { v : 77, f : function () { this.v = 14; } }; with ( o ) { var f2 = f; f2 (); }';	// o.v = 77, global.v = 14

	//code = '"use strict"; var o = {}; Object.preventExtensions ( o ); o.a = 14;';	// should throw
	//code = '"use strict"; var o = {}; Object.seal ( o ); o.a = 14;';	// should throw
	//code = '"use strict"; var o = {}; Object.seal ( o ); o.a += 14;';	// should throw
	//code = '"use strict"; var o = { a : 14 }; Object.freeze ( o ); o.a += 14;';	// should throw

	// TODO: d is not 0 in Chrome sometimes.
	//code = 'var x = 9007199254740994.0; /* 2^53 + 2 */ var y = 1.0 - 1/65536.0; var z = x + y; var d = z - x;';	// d = 0

	//code = 'function getr () { return /a/gim; } var r1 = getr (), r2 = getr (), eq = r1 === r2;';	// eq = false

	//code = '({})';

	// Strict/non strict:
	//code = '"use strict"; var a; function f () { a = this; } f ();';
	//code = 'var a; function f () { a = this; } f ();';
	//code = '"use strict"; a = 5;';
	//code = 'a = 5;';
	//code = 'var o = {}; Object.defineProperty ( o, "p", { writable : false, value : 14 } ); o.p = 15;';
	//code = '"use strict"; var o = {}; Object.defineProperty ( o, "p", { writable : false, value : 14 } ); o.p = 15;';
	//code = 'delete Object.prototype;';
	//code = '"use strict"; delete Object.prototype;';
	//code = 'var o = { a : 5, "a" : 6 };';
	//code = '"use strict"; var o = { a : 5, "a" : 6 };';
	//code = '"use strict"; function f () {}';
	//code = '"use strict"; { function f () {} }';
	//code = '"use strict"; function f () { function g () {} }';
	//code = '"use strict"; function f () { if ( true ) { function g () {} } }';
	//code = '"use strict"; Object.defineProperty ( this, "a", { writable : false, value : 14 } ); a = 5;';
	//code = 'function f () { "use strict"; return arguments.callee; } var a = f ( 1, 2 );';	// should throw
	//code = 'function f () { return arguments; } var a = f ( 1, 2 );';
	
	//code = 'for ( var j = 0 ; j < 1000 ; j++ ) { var a = 0, b = 1; for ( var i = 0 ; i < 1000 ; i++ ) { if ( i % 2 === 0 ) a = a + b; else b = a + b; } }';
	//code = 'for ( var j = 0 ; j < 10 ; j++ ) { var arr = []; for ( var i = 0 ; i < 10000 ; i++ ) arr [i] = i; }';
	//code = 'for ( var j = 0 ; j < 100 ; j++ ) { var i = 0; var arr = []; while ( i++ < 10000 ) { arr [i] = i; } }';
	//code = 'var r = 0; for ( var i = 0 ; i < 100000 ; i++ ) { r = ( r + Math.cos ( i ) ) % 1000; }';
	//code = 'for ( var i = 0 ; i < 100000 ; i++ ) { "a b c".split ( " " ); }';
	// TODO: implement DebuggerStatement

	//code = 'var prop = \\u2029;';	// should throw
	//code = 'var \\u0030a = 5;';	// should throw
	//code = 'var a\\u0030 = 5;';	a0 = 5
	//code = 'var a\\u000d = 5;';	// should throw
	//code = 'function arguments () {}';	// should NOT throw
	//code = '"use strict"; function arguments () {}';	// should throw
	//code = 'function arguments () { "use strict"; }';	// should throw
	//code = 'var eval = 5;';	// eval = 5
	//code = '({get foo(){}, get foo(){}})';	// should throw
	//code = '({a : 5, a : 6})';	// should NOT throw
	//code = '"use strict"; ({a : 5, a : 6})';	// should throw
	//code = '({foo : 5, get foo(){}})';	// should throw
	//code = 'eval("\'use strict\'; function _13_1_23_fun(param, param) { }");';
	//code = '"use strict"; function _13_1_23_fun(param, param) { }';	// should throw
	//code = 'function f ( a, a ) {}';	// should NOT throw
	//code = 'var a = "__proto__" in {}';
	//code = '({}).__proto__ ()';
	//code = '__proto__';

	code = 'function testcase() { var obj = {}; var data; Object.defineProperty(obj, "accProperty", { set: function (value) { var _10_1_1_28_s = {a:1, a:2}; data = value; "use strict"; } }); obj.accProperty = "overrideData"; return data==="overrideData"; } testcase ();';

	var timeStart = Date.now ();

	//eval ( code );

	var timeEnd = Date.now (),
		nativeTimeElapsed = ( timeEnd - timeStart ) / 1000;

	console.log ( 'Native execution took ' + nativeTimeElapsed + 'sec' );
	
	rstDev ( code );

	console.log ( 'Rst/Native: ' + ( rstTimeElapsed / nativeTimeElapsed ) );
	console.log ( 'Scope control/Native: ' + ( scopeControlTimeElapsed / nativeTimeElapsed ) );
}

rstTest ();

window.addEventListener ( 'load', function () {
	var sandbox : Sandbox = null,
		guestLogElt = document.getElementById ( 'guest-log' ),
		guestGlobalsElt = document.getElementById ( 'guest-globals' ),
		scopeWatch : WatchWidget = null,
		consoleLines = [''],
		consoleLineIdx = 0;

	function logWrite ( message : string ) {
		var lineSpan = document.createElement ( 'span' );
		lineSpan.innerText = message;
		guestLogElt.appendChild ( lineSpan );
	}

	function logError ( error : any ) {
		if ( error instanceof RequestExecutionError ) {
			var reqExecutionError = <RequestExecutionError> error;
			error = reqExecutionError.serverMessage;
		}

		var eErr = document.createElement ( 'div' );
		eErr.className = 'exec-error';
		eErr.innerText = error + '';
		guestLogElt.appendChild ( eErr );
	}

	var codeEditor = CodeMirror.fromTextArea ( document.getElementById ( 'cm-code' ), {
		mode : 'javascript',
	    lineNumbers : true,
	    matchBrackets : true,
	    continueComments : 'Enter',
		theme : 'solarized light'
	} ),
	/* TODO: console (input/output)Mark should be in different block so that manual text
	 * selection won't grab them. Or convert them to images, they're not copied with text. */
	consoleEditor = CodeMirror.fromTextArea ( document.getElementById ( 'cm-console' ), {
		mode : 'javascript',
	    lineNumbers : false,
	    matchBrackets : true,
		theme : 'solarized light',
		extraKeys : {
			Enter : function ( cm ) {
				var code = cm.getValue ().replace ( /^[\s]*(.*?)\s*$/, '$1' ),
					cmElt = <HTMLElement> cm.getWrapperElement (),
					lineElts = cmElt.querySelectorAll ( '.CodeMirror-lines pre' ),
					codeElt : HTMLElement;
				
				if ( lineElts.length > 0 ) {	// Try to copy text highlighted by codemirror.
					var cmThemeClassName = cm.options.theme
						.split ( ' ' )
						.map ( className => 'cm-s-' + className )
						.join ( ' ' ),
						curLineElt = <HTMLElement> lineElts [1].cloneNode ( true );
					codeElt = document.createElement ( 'div' );
					codeElt.className = cmThemeClassName + ' console-executed-code';
					codeElt.appendChild ( curLineElt );
				} else {	// Fallback to non-highlighted text.
					codeElt = document.createElement ( 'span' );
					codeElt.innerText = code + '\n';
				}

				cm.setValue ( '' );

				if ( code.length === 0 )
					return;

				var eInputMark = document.createElement ( 'div' );
				eInputMark.innerText = '>';
				eInputMark.className = 'input-mark';
				guestLogElt.appendChild ( eInputMark );
				guestLogElt.appendChild ( codeElt );

				sandbox.exec ( code,
					function ( storedResultId : number ) {
						var eOutputMark = document.createElement ( 'div' );
						eOutputMark.innerText = '<';
						eOutputMark.className = 'output-mark';
						guestLogElt.appendChild ( eOutputMark );

						var watchWidget = new WatchWidget ( sandbox, storedResultId + '', false, false );
						guestLogElt.appendChild ( watchWidget.rootElement );
					},
					logError,
					function () {
						//logWrite ( 'Console always () callback called.\n' );
					}
				);

				if ( consoleLineIdx < consoleLines.length - 1 ) {
					consoleLines.pop ();
					consoleLines.push ( code );
				}

				if ( consoleLines.length > 1 &&
					code === consoleLines [consoleLines.length - 2] )
				{
					// Avoid duplicate entries.
					consoleLines.pop ();
				}

				consoleLines.push ( '' );
				consoleLineIdx = consoleLines.length - 1;
				localStorage.setItem ( 'console', code );
				localStorage.setItem ( 'console-lines', JSON.stringify ( consoleLines ) );
			},
			Up : function ( cm ) {
				if ( --consoleLineIdx < 0 )
					consoleLineIdx = 0;
				else {
					var code = consoleLines [consoleLineIdx];
					cm.setValue ( code );
					cm.setCursor ( { line : 1, ch : code.length } );
				}
			},
			Down : function ( cm ) {
				if ( ++consoleLineIdx >= consoleLines.length )
					consoleLineIdx = consoleLines.length - 1;
				else {
					var code = consoleLines [consoleLineIdx];
					cm.setValue ( code );
					cm.setCursor ( { line : 1, ch : code.length } );
				}
			}
		}
	} );

	consoleEditor.on ( 'change', function () {
		var code = consoleEditor.getValue ();

		if ( consoleLineIdx === consoleLines.length - 1 )
			consoleLines [consoleLineIdx] = code;

		localStorage.setItem ( 'console', code );
		localStorage.setItem ( 'console-lines', JSON.stringify ( consoleLines ) );
	} );

	codeEditor.focus ();
	
	codeEditor.on ( 'change', function () {
		var code = codeEditor.getValue ();
		localStorage.setItem ( 'code', code );

		guestLogElt.innerHTML = '';

		if ( scopeWatch !== null )
			guestGlobalsElt.removeChild ( scopeWatch.rootElement );

		if ( sandbox !== null )
			sandbox.terminate ();

		sandbox = new Sandbox ( window ['esprima'], -1 );	// DEBUG: -1 is for debugging purposes.
		sandbox.onReady ( function () {
			logWrite ( 'sandbox-core is ready\n' );
		} );
		sandbox.onLog ( function ( message : string ) {
			logWrite ( message );
		} );
		sandbox.onDir ( function ( storedObjectId : number ) {
			var watchWidget = new WatchWidget ( sandbox, storedObjectId + '', true, false );
			guestLogElt.appendChild ( watchWidget.rootElement );
		} );
		sandbox.onExecFinished ( function ( success : boolean, storedResultId : number, error : any ) {
			// DEBUG. In future every exec operation must do its stuff with result in its own callback.
			//if ( !success )
			//	logWrite ( 'onExecFinished< ' + error + '\n' );
		} );
		sandbox.onRequestTimeout ( function ( requestType : string, timeout : number ) {
			logWrite ( 'Request "' + requestType + '" timed out, sandbox will be terminated.\n' );
			sandbox.terminate ();
		} );
		sandbox.onInternalError ( function ( error : any ) {
			logWrite ( 'Sandbox internal error event: ' + error + '\n' );
		} );
		sandbox.onTerminated ( function () {
			logWrite ( 'Sandbox was terminated\n' );
		} );

		sandbox.exec ( code,
			function ( storedResultId : number ) {
				//var treeQuery = {
				//	name : storedResultId + '',
				//	props : [{
				//		name : 'b',
				//		props : []
				//	}]
				//};
				//sandbox.reflectByTree ( treeQuery, function ( reflectedObject : ReflectedValue, tree : ReflectByTreeQueryNode, userData : any ) {
				//	var oRefl = reflectedObject;
				//	//logWrite ( JSON.stringify ( oRefl, null, '  ' ) + '\n' );
				//} );

				//// NOTE: intended type error <any>storedResultId. Should be storedResultId + ''.
				//sandbox.reflectByPath ( [<any>storedResultId, 'b', null],
				//	function ( reflectedObject : ReflectedValue, path : string [], userData : any ) {
				//		var oRefl = reflectedObject;
				//	}/*,
				//	function ( error : any, userData : any ) {
				//		logWrite ( 'reflectByPath () failure: ' + error + '\n' );
				//	}*/
				//);
			},
			logError
		);

		//scopeWatch = new WatchWidget ( sandbox, 'Scope', true, true, 'Scope', true );
		//guestGlobalsElt.appendChild ( scopeWatch.rootElement );
		scopeWatch = new WatchWidget ( sandbox, 'Globals', true, true, 'Globals', true );
		guestGlobalsElt.appendChild ( scopeWatch.rootElement );
	} );

	var toggleEnabled = document.getElementById ( 'toggle-enabled' );
	toggleEnabled.addEventListener ( 'click', function () {
		scopeWatch.isEnabled = !scopeWatch.isEnabled;
	}, false );

	var terminateSandbox = document.getElementById ( 'terminate-sandbox' );
	terminateSandbox.addEventListener ( 'click', function () {
		sandbox.terminate ();
	}, false );

	codeEditor.on ( 'cursorActivity', function () {
		var cursor = codeEditor.getCursor ();
		localStorage.setItem ( 'cursor', JSON.stringify ( cursor ) );
	} );

	// Restore code editor
	var backedUpCode = localStorage.getItem ( 'code' );

	if ( backedUpCode !== null )
		codeEditor.setValue ( backedUpCode );

	var backedUpCursor = localStorage.getItem ( 'cursor' );

	if ( backedUpCursor !== null )
		codeEditor.setCursor ( JSON.parse ( backedUpCursor ) );

	// Restore console editor
	var backedUpConsoleLines = localStorage.getItem ( 'console-lines' );

	if ( backedUpConsoleLines !== null )
		consoleLines = JSON.parse ( backedUpConsoleLines );

	consoleLineIdx = consoleLines.length - 1;

	var backedUpConsole = localStorage.getItem ( 'console' );

	if ( backedUpConsole !== null )
		consoleEditor.setValue ( backedUpConsole );
}, false );