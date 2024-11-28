export class ExpressionParser {
    // 运算符优先级
    private precedence: { [key: string]: number } = {
        'or': 1,
        'and': 2
    };

    parse(expression: string): RegExp {
        const tokens = this.tokenize(expression);
        const result = this.evaluateExpression(tokens);
        return new RegExp(result, 'i');
    }

    private tokenize(expression: string): string[] {
        const tokens: string[] = [];
        let pos = 0;

        while (pos < expression.length) {
            // 跳过空白
            while (pos < expression.length && /\s/.test(expression[pos])) {
                pos++;
            }

            if (pos >= expression.length) {
                break;
            }

            // 处理括号
            if (expression[pos] === '(' || expression[pos] === ')') {
                tokens.push(expression[pos]);
                pos++;
                continue;
            }

            // 处理引号中的模式
            if (expression[pos] === '"') {
                let pattern = '';
                pos++; // 跳过开始引号
                
                while (pos < expression.length && expression[pos] !== '"') {
                    if (expression[pos] === '\\' && pos + 1 < expression.length) {
                        // 处理转义字符
                        pattern += expression[pos + 1];
                        pos += 2;
                    } else {
                        pattern += expression[pos];
                        pos++;
                    }
                }
                
                if (pos >= expression.length) {
                    throw new Error('Unterminated quoted string');
                }
                
                pos++; // 跳过结束引号
                tokens.push(this.wildcardToRegex(pattern));
                continue;
            }

            // 处理操作符
            if (expression.slice(pos).toLowerCase().startsWith('and')) {
                tokens.push('and');
                pos += 3;
                continue;
            }
            if (expression.slice(pos).toLowerCase().startsWith('or')) {
                tokens.push('or');
                pos += 2;
                continue;
            }

            // 如果到这里还没有匹配，说明是无效的字符
            throw new Error(`Unexpected character at position ${pos}: ${expression[pos]}`);
        }

        return tokens;
    }

    private evaluateExpression(tokens: string[]): string {
        const operands: string[] = [];  // 操作数栈
        const operators: string[] = [];  // 运算符栈

        for (const token of tokens) {
            if (token === '(') {
                operators.push(token);
            }
            else if (token === ')') {
                // 处理直到遇到左括号
                while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                    this.processOperator(operands, operators);
                }
                if (operators.length === 0) {
                    throw new Error('Mismatched parentheses: missing opening parenthesis');
                }
                operators.pop(); // 弹出左括号
            }
            else if (token === 'and' || token === 'or') {
                // 处理优先级更高或相等的运算符
                while (operators.length > 0 && operators[operators.length - 1] !== '(' &&
                       this.precedence[operators[operators.length - 1]] >= this.precedence[token]) {
                    this.processOperator(operands, operators);
                }
                operators.push(token);
            }
            else {
                // 操作数直接入栈
                operands.push(token);
            }
        }

        // 处理剩余的运算符
        while (operators.length > 0) {
            if (operators[operators.length - 1] === '(') {
                throw new Error('Mismatched parentheses: missing closing parenthesis');
            }
            this.processOperator(operands, operators);
        }

        if (operands.length !== 1) {
            throw new Error('Invalid expression: too many operands');
        }

        return operands[0];
    }

    private processOperator(operands: string[], operators: string[]) {
        if (operands.length < 2) {
            throw new Error('Invalid expression: not enough operands');
        }

        const operator = operators.pop()!;
        const right = operands.pop()!;
        const left = operands.pop()!;

        let result: string;
        if (operator === 'and') {
            // 处理嵌套的 AND 操作
            const leftPart = left.startsWith('(?=.*') ? left : `(?=.*${left})`;
            const rightPart = right.startsWith('(?=.*') ? right : `(?=.*${right})`;
            result = leftPart + rightPart;
        } else { // or
            // 处理嵌套的 OR 操作
            const leftPart = left.startsWith('(?=.*') ? `(${left})` : left;
            const rightPart = right.startsWith('(?=.*') ? `(${right})` : right;
            
            // 移除不必要的括号
            const cleanLeft = leftPart.startsWith('(') && leftPart.endsWith(')') ? leftPart.slice(1, -1) : leftPart;
            const cleanRight = rightPart.startsWith('(') && rightPart.endsWith(')') ? rightPart.slice(1, -1) : rightPart;
            
            result = `(${cleanLeft}|${cleanRight})`;
        }

        operands.push(result);
    }

    private wildcardToRegex(pattern: string): string {
        // 处理通配符
        let result = pattern.split('*').map(part => {
            // 转义特殊字符
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('.*');
        
        return result;
    }
}
