import * as assert from 'assert';
import { ExpressionParser } from '../expression-parser';

describe('ExpressionParser', () => {
    let parser: ExpressionParser;

    beforeEach(() => {
        parser = new ExpressionParser();
    });

    describe('Basic Pattern Tests', () => {
        it('should parse simple pattern', () => {
            const regex = parser.parse('"error"');
            assert.strictEqual(regex.source, 'error');
        });

        it('should handle wildcard pattern', () => {
            const regex = parser.parse('"error*"');
            assert.strictEqual(regex.source, 'error.*');
        });

        it('should escape special regex characters', () => {
            const regex = parser.parse('"error.log[2]"');
            assert.strictEqual(regex.source, 'error\\.log\\[2\\]');
        });
    });

    describe('Logical Operator Tests', () => {
        it('should handle AND operator', () => {
            const regex = parser.parse('"error" and "fatal"');
            assert.strictEqual(regex.source, '(?=.*error)(?=.*fatal)');
        });

        it('should handle OR operator', () => {
            const regex = parser.parse('"error" or "warning"');
            assert.strictEqual(regex.source, '(error|warning)');
        });

        it('should handle multiple AND operators', () => {
            const regex = parser.parse('"error" and "fatal" and "2024"');
            assert.strictEqual(regex.source, '(?=.*error)(?=.*fatal)(?=.*2024)');
        });

        it('should handle multiple OR operators', () => {
            const regex = parser.parse('"error" or "warning" or "info"');
            assert.strictEqual(regex.source, '(error|warning|info)');
        });
    });

    describe('Complex Expression Tests', () => {
        it('should handle parentheses with AND and OR', () => {
            const regex = parser.parse('("error" or "fatal") and "2024"');
            assert.strictEqual(regex.source, '(?=.*(error|fatal))(?=.*2024)');
        });

        it('should handle nested parentheses', () => {
            const regex = parser.parse('("error" or ("fatal" and "critical")) and "2024"');
            assert.strictEqual(regex.source, '(?=.*(error|(?=.*fatal)(?=.*critical)))(?=.*2024)');
        });

        it('should handle wildcards in complex expressions', () => {
            const regex = parser.parse('("error*" or "*fatal") and "2024*"');
            assert.strictEqual(regex.source, '(?=.*(error.*|.*fatal))(?=.*2024.*)');
        });
    });

    describe('Error Handling Tests', () => {
        it('should throw error for unmatched opening parenthesis', () => {
            assert.throws(() => {
                parser.parse('("error" and "fatal"');
            }, /Mismatched parentheses/);
        });

        it('should throw error for unmatched closing parenthesis', () => {
            assert.throws(() => {
                parser.parse('"error" and "fatal")');
            }, /Mismatched parentheses/);
        });

        it('should throw error for unterminated quoted string', () => {
            assert.throws(() => {
                parser.parse('"error');
            }, /Unterminated quoted string/);
        });

        it('should throw error for missing quotes', () => {
            assert.throws(() => {
                parser.parse('error and fatal');
            }, /Unexpected character/);
        });

        it('should throw error for invalid operators', () => {
            assert.throws(() => {
                parser.parse('"error" & "fatal"');
            }, /Unexpected character/);
        });
    });

    describe('Case Sensitivity Tests', () => {
        it('should handle case-insensitive AND operator', () => {
            const regex1 = parser.parse('"error" AND "fatal"');
            const regex2 = parser.parse('"error" and "fatal"');
            assert.strictEqual(regex1.source, regex2.source);
        });

        it('should handle case-insensitive OR operator', () => {
            const regex1 = parser.parse('"error" OR "fatal"');
            const regex2 = parser.parse('"error" or "fatal"');
            assert.strictEqual(regex1.source, regex2.source);
        });
    });

    describe('Pattern Matching Tests', () => {
        it('should match simple pattern', () => {
            const regex = parser.parse('"error"');
            assert.ok(regex.test('error in line 5'));
            assert.ok(regex.test('an error occurred'));
            assert.ok(!regex.test('warning in line 5'));
        });

        it('should match AND pattern', () => {
            const regex = parser.parse('"error" and "line"');
            assert.ok(regex.test('error in line 5'));
            assert.ok(!regex.test('error occurred'));
            assert.ok(!regex.test('line 5'));
        });

        it('should match OR pattern', () => {
            const regex = parser.parse('"error" or "warning"');
            assert.ok(regex.test('error in line 5'));
            assert.ok(regex.test('warning in line 5'));
            assert.ok(!regex.test('info in line 5'));
        });

        it('should match wildcard pattern', () => {
            const regex = parser.parse('"error*"');
            assert.ok(regex.test('error'));
            assert.ok(regex.test('errors'));
            assert.ok(regex.test('error_log'));
            assert.ok(regex.test('an error occurred')); 
        });

        it('should match complex pattern', () => {
            const regex = parser.parse('("error*" or "fatal*") and "2024"');
            assert.ok(regex.test('error: something went wrong in 2024'));
            assert.ok(regex.test('fatal crash occurred in 2024'));
            assert.ok(!regex.test('warning: issue in 2024'));
            assert.ok(!regex.test('error: something went wrong in 2023'));
        });
    });
});
