/**
 * 金额大写转换
 */

// 中文数字映射
const CN_NUMBERS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
// 中文单位映射
const CN_UNITS = ['', '拾', '佰', '仟'];
// 中文大单位映射
const CN_BIG_UNITS = ['', '万', '亿', '兆'];
// 货币单位
const CN_CURRENCY = ['元', '角', '分'];

/**
 * 将数字转换为中文大写金额
 * @param amount 金额数字
 * @returns 中文大写金额字符串
 */
export function toChineseAmount(amount: number): string {
  if (isNaN(amount) || amount < 0) {
    return '';
  }

  if (amount === 0) {
    return '零元整';
  }

  // 保留两位小数
  const fixedAmount = Math.round(amount * 100) / 100;
  const [integerPart, decimalPart] = fixedAmount.toFixed(2).split('.');

  let result = '';

  // 处理整数部分
  if (parseInt(integerPart) > 0) {
    result += convertIntegerPart(integerPart) + '元';
  }

  // 处理小数部分
  const jiao = parseInt(decimalPart[0]);
  const fen = parseInt(decimalPart[1]);

  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) {
      result += CN_NUMBERS[jiao] + '角';
    } else if (parseInt(integerPart) > 0) {
      result += '零';
    }
    if (fen > 0) {
      result += CN_NUMBERS[fen] + '分';
    }
  }

  return result;
}

/**
 * 转换整数部分
 */
function convertIntegerPart(numStr: string): string {
  const len = numStr.length;
  let result = '';
  let zeroFlag = false;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const pos = len - 1 - i;
    const sectionPos = Math.floor(pos / 4);
    const unitPos = pos % 4;

    if (digit === 0) {
      zeroFlag = true;
      if (unitPos === 0 && sectionPos > 0) {
        // 检查该节是否有非零数字
        let hasNonZero = false;
        for (let j = i - 3; j <= i; j++) {
          if (j >= 0 && parseInt(numStr[j]) > 0) {
            hasNonZero = true;
            break;
          }
        }
        if (hasNonZero) {
          result += CN_BIG_UNITS[sectionPos];
        }
      }
    } else {
      if (zeroFlag) {
        result += CN_NUMBERS[0];
        zeroFlag = false;
      }
      result += CN_NUMBERS[digit] + CN_UNITS[unitPos];
      if (unitPos === 0 && sectionPos > 0) {
        result += CN_BIG_UNITS[sectionPos];
      }
    }
  }

  return result;
}
