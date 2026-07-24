const ALLOWED_TIMES = ['morning', 'afternoon', 'evening', 'bedtime'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 20;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function validateItem(item, index) {
  const errors = [];
  const prefix = `medicines[${index}]`;
  const { medicine_name, dose_amount, caution } = item || {};

  if (typeof medicine_name !== 'string' || medicine_name.trim().length === 0) {
    errors.push(`${prefix}.medicine_name은 필수입니다.`);
  } else if (medicine_name.length > 200) {
    errors.push(`${prefix}.medicine_name은 200자를 초과할 수 없습니다.`);
  }

  if (typeof dose_amount !== 'string' || dose_amount.trim().length === 0) {
    errors.push(`${prefix}.dose_amount는 필수입니다.`);
  } else if (dose_amount.length > 50) {
    errors.push(`${prefix}.dose_amount는 50자를 초과할 수 없습니다.`);
  }

  if (caution !== undefined && caution !== null && typeof caution !== 'string') {
    errors.push(`${prefix}.caution은 문자열이어야 합니다.`);
  }

  return errors;
}

function validatePrescriptionInput(body) {
  const errors = [];
  const { times, start_date, end_date, medicines } = body || {};

  if (!Array.isArray(times) || times.length === 0) {
    errors.push('times는 1개 이상의 배열이어야 합니다.');
  } else if (!times.every((t) => ALLOWED_TIMES.includes(t))) {
    errors.push(`times는 ${ALLOWED_TIMES.join(', ')} 중에서만 선택할 수 있습니다.`);
  } else if (new Set(times).size !== times.length) {
    errors.push('times에 중복된 값이 있습니다.');
  }

  if (!isValidDate(start_date)) {
    errors.push('start_date는 YYYY-MM-DD 형식의 날짜여야 합니다.');
  }
  if (!isValidDate(end_date)) {
    errors.push('end_date는 YYYY-MM-DD 형식의 날짜여야 합니다.');
  }
  if (isValidDate(start_date) && isValidDate(end_date) && end_date < start_date) {
    errors.push('end_date는 start_date보다 빠를 수 없습니다.');
  }

  if (!Array.isArray(medicines) || medicines.length === 0) {
    errors.push('medicines는 1개 이상의 배열이어야 합니다.');
  } else if (medicines.length > MAX_ITEMS) {
    errors.push(`medicines는 최대 ${MAX_ITEMS}개까지 입력할 수 있습니다.`);
  } else {
    medicines.forEach((item, index) => {
      errors.push(...validateItem(item, index));
    });
  }

  return errors;
}

module.exports = { validatePrescriptionInput, ALLOWED_TIMES, MAX_ITEMS };
