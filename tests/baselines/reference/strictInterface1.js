//// [strictInterface1.ts]

strict interface Options {
	name?: string;
	length?: number;
	self?: Options;
}

// Augmented strict interfaces are ok
interface Options {
	other?: any;
}

// It's OK to extend a strict interface; strictness
// is not inherited
interface MoreOptions extends Options {}



var a: Options;
a = {}; // OK
a = 32; // Error
a = { x: '' }; // Error
a = { name: '' }; // OK
a = { name: 32 }; // Error

var b: MoreOptions;
b = {}; // OK
b = 32; // OK
b = { x: '' }; // OK
b = { name: '' }; // OK
b = { name: 32 }; // OK



//// [strictInterface1.js]
var a;
a = {}; // OK
a = 32; // Error
a = { x: '' }; // Error
a = { name: '' }; // OK
a = { name: 32 }; // Error
var b;
b = {}; // OK
b = 32; // OK
b = { x: '' }; // OK
b = { name: '' }; // OK
b = { name: 32 }; // OK
