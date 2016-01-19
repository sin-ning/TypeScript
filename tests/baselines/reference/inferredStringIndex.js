//// [inferredStringIndex.ts]

interface Headers {
  [x: string]: string;
}
interface Counts {
  [x: string]: number;
}

interface Primitives {
  [x: string]: number|string;
}

let a = { 'User-agent': 'moz', 'Timeout': undefined }
let b = { x: 1, y: 2 };

let h: Headers;
h = a; // OK
h = b; // Error

let c: Counts;
c = a; // Error
c = b; // OK

let p: Primitives
p = a; // OK
p = b; // OK


//// [inferredStringIndex.js]
var a = { 'User-agent': 'moz', 'Timeout': undefined };
var b = { x: 1, y: 2 };
var h;
h = a; // OK
h = b; // Error
var c;
c = a; // Error
c = b; // OK
var p;
p = a; // OK
p = b; // OK
