"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressionParser = void 0;
class ExpressionParser {
    constructor() {
        this.pos = 0;
        this.input = '';
    }
    parse(expression) {
        this.pos = 0;
        this.input = expression;
        const pattern = this.parseOr();
        return new RegExp(pattern, 'i'); // 使用不区分大小写的模式
    }
    parseOr() {
        const terms = [];
        terms.push(this.parseAnd());
        while (this.pos < this.input.length) {
            if (this.consumeOperator('or')) {
                terms.push(this.parseAnd());
            }
            else {
                break;
            }
        }
        return terms.length > 1 ? `(${terms.join('|')})` : terms[0];
    }
    parseAnd() {
        const terms = [];
        terms.push(this.parseTerm());
        while (this.pos < this.input.length) {
            if (this.consumeOperator('and')) {
                terms.push(this.parseTerm());
            }
            else {
                break;
            }
        }
        return terms.length > 1 ? `(?=.*${terms.join(')(?=.*')})` : terms[0];
    }
    parseTerm() {
        this.consumeWhitespace();
        if (this.pos >= this.input.length) {
            throw new Error('Unexpected end of expression');
        }
        // 处理括号
        if (this.input[this.pos] === '(') {
            this.pos++; // 跳过左括号
            const result = this.parseOr();
            this.consumeWhitespace();
            if (this.pos >= this.input.length || this.input[this.pos] !== ')') {
                throw new Error('Missing closing parenthesis');
            }
            this.pos++; // 跳过右括号
            return result;
        }
        // 处理引号包裹的内容
        if (this.input[this.pos] === '"') {
            return this.parseQuotedString();
        }
        throw new Error('Expected quoted string or parenthesis');
    }
    parseQuotedString() {
        this.pos++; // 跳过开始引号
        let pattern = '';
        let escaped = false;
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (escaped) {
                if (char === '"' || char === '\\' || char === '*') {
                    pattern += char;
                }
                else {
                    pattern += '\\' + char;
                }
                escaped = false;
            }
            else if (char === '\\') {
                escaped = true;
            }
            else if (char === '"') {
                this.pos++; // 跳过结束引号
                // 将通配符转换为正则表达式
                return this.wildcardToRegex(pattern);
            }
            else {
                pattern += char;
            }
            this.pos++;
        }
        throw new Error('Unterminated quoted string');
    }
    wildcardToRegex(pattern) {
        let result = '';
        let escaped = false;
        for (let i = 0; i < pattern.length; i++) {
            const char = pattern[i];
            if (escaped) {
                if (char === '*') {
                    result += '\\*';
                }
                else {
                    result += '\\' + char;
                }
                escaped = false;
            }
            else if (char === '\\') {
                escaped = true;
            }
            else if (char === '*') {
                result += '.*';
            }
            else {
                result += this.escapeRegExp(char);
            }
        }
        return result;
    }
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    consumeWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }
    consumeOperator(operator) {
        this.consumeWhitespace();
        if (this.pos + operator.length <= this.input.length) {
            const substr = this.input.substr(this.pos, operator.length).toLowerCase();
            if (substr === operator.toLowerCase()) {
                this.pos += operator.length;
                return true;
            }
        }
        return false;
    }
}
exports.ExpressionParser = ExpressionParser;
//# sourceMappingURL=expression-parser.js.map