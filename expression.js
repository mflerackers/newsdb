/* Returns the result of a unary expression
*/
function calcUnaryExpression(env, node) {
    switch (node.operator) {
        case "+":
            return +calcExpression(env, node.argument);
        case "-":
            return -calcExpression(env, node.argument);
        default:
            throw new Error("Unknown operator " + node.operator);
    }
}

/* Returns the result of a binary expression
*/
function calcBinaryExpression(env, node) {
    switch (node.operator) {
        case "+":
            return +calcExpression(env, node.left) + +calcExpression(env, node.right);
        case "-":
            return +calcExpression(env, node.left) - +calcExpression(env, node.right);
        case "*":
            return +calcExpression(env, node.left) * +calcExpression(env, node.right);
        case "/":
            return +calcExpression(env, node.left) / +calcExpression(env, node.right);
        case "&":
            return calcExpression(env, node.left) + calcExpression(env, node.right);
        case "==":
            return calcExpression(env, node.left) == calcExpression(env, node.right);
        default:
            throw new Error("Unknown operator " + node.operator);
    }
}

/* Returns the value of an identifier
*/
function calcIdentifier(env, name) {
    return env[name];
}

/* Returns the member of an object
*/
function calcMemberExpression(env, node) {
    let object = calcExpression(env, node.object);
    if (!object) {
        return undefined;
    }
    if (node.computed) {

    }
    let property = node.computed ? calcExpression(env, node.property) : node.property.name;
    return object[property];
}

function calcConditionalExpression(env, node) {
    let test = calcExpression(env, node.test);
    return test ? calcExpression(env, node.consequent) : calcExpression(env, node.alternate);
}

/* Returns the result of a function call
*/
function calcCallExpression(env, node) {
    let callee = calcExpression(env, node.callee);
    let arguments = node.arguments.map(node => calcExpression(env, node));
    return callee(...arguments);
}

/* Returns the value of an expression
*/
function calcExpression(env, node) {
    switch (node.type) {
        case "Literal":
            return node.value;
        case "Identifier":
            return calcIdentifier(env, node.name);
        case "UnaryExpression":
            return calcUnaryExpression(env, node);
        case "BinaryExpression":
            return calcBinaryExpression(env, node);
        case "MemberExpression":
            return calcMemberExpression(env, node);
        case "ArrayExpression":
            return node.elements.map(node => calcExpression(env, node));
            break;
        case "ConditionalExpression":
            return calcConditionalExpression(env, node);
        case "CallExpression":
            return calcCallExpression(env, node);
        default:
            console.log(node);
            throw new Error("Unknown type " + node.type);
    }
}

/* Returns the addresses used in an expression
*/
function getExpressionIdentifiers(node, list) {
    switch (node.type) {
        case "Literal":
            break;
        case "Identifier":
            list.push(node.name);
            break;
        case "UnaryExpression":
            getExpressionIdentifiers(node.argument, list);
            break;
        case "BinaryExpression":
            getExpressionIdentifiers(node.left, list);
            getExpressionIdentifiers(node.right, list);
            break;
        case "MemberExpression":
            getExpressionIdentifiers(node.object, list);
            break;
        case "ArrayExpression":
            node.elements.forEach(node => getExpressionIdentifiers(node, list));
            break;
        case "CallExpression":
            getExpressionIdentifiers(node.callee, list);
            node.arguments.forEach(node => getExpressionIdentifiers(node, list));
            break;
        default:
            throw new Error("Unknown expression type " + node.type);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcExpression: calcExpression
    }
}