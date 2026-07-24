(function () {
  const STORAGE_KEY = 'yaksok_admin_api_key';

  const keyGate = document.getElementById('key-gate');
  const adminApp = document.getElementById('admin-app');
  const keyForm = document.getElementById('key-form');
  const keyInput = document.getElementById('api-key-input');
  const keyError = document.getElementById('key-error');
  const changeKeyBtn = document.getElementById('change-key-btn');

  function getStoredKey() {
    return sessionStorage.getItem(STORAGE_KEY);
  }

  function showGate(message) {
    adminApp.classList.add('hidden');
    keyGate.classList.remove('hidden');
    if (message) {
      keyError.textContent = message;
      keyError.classList.remove('hidden');
    } else {
      keyError.textContent = '';
      keyError.classList.add('hidden');
    }
    keyInput.value = '';
    keyInput.focus();
  }

  function showApp() {
    keyGate.classList.add('hidden');
    adminApp.classList.remove('hidden');
  }

  function invalidateKey(message) {
    sessionStorage.removeItem(STORAGE_KEY);
    showGate(message || 'API 키가 올바르지 않습니다.');
  }

  keyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const value = keyInput.value.trim();
    if (!value) return;
    sessionStorage.setItem(STORAGE_KEY, value);
    showApp();
  });

  changeKeyBtn.addEventListener('click', function () {
    invalidateKey(null);
  });

  if (getStoredKey()) {
    showApp();
  } else {
    showGate(null);
  }

  // ---- 처방전 등록 폼 ----

  const form = document.getElementById('prescription-form');
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const resultCard = document.getElementById('result-card');
  const resultImage = document.getElementById('result-qr-image');
  const resultUrl = document.getElementById('result-qr-url');
  const resultDownload = document.getElementById('result-download');

  const medicineList = document.getElementById('medicine-list');
  const addMedicineBtn = document.getElementById('add-medicine-btn');
  const rowTemplate = document.getElementById('medicine-row-template');

  function renumberRows() {
    medicineList.querySelectorAll('.medicine-row').forEach((row, i) => {
      row.querySelector('.medicine-row-title').textContent = `약 ${i + 1}`;
    });
  }

  function addMedicineRow() {
    const fragment = rowTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.medicine-row');
    row.querySelector('.remove-medicine-btn').addEventListener('click', () => {
      if (medicineList.querySelectorAll('.medicine-row').length <= 1) return;
      row.remove();
      renumberRows();
    });
    medicineList.appendChild(row);
    renumberRows();
  }

  addMedicineBtn.addEventListener('click', addMedicineRow);
  addMedicineRow();

  function showFormError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function clearFormError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function collectMedicines() {
    return Array.from(medicineList.querySelectorAll('.medicine-row')).map((row) => ({
      medicine_name: row.querySelector('.medicine-name').value.trim(),
      dose_amount: row.querySelector('.medicine-dose').value.trim(),
      caution: row.querySelector('.medicine-caution').value.trim(),
    }));
  }

  function validate(data) {
    if (data.times.length === 0) return '복용 시간을 1개 이상 선택해주세요.';
    if (!data.start_date || !data.end_date) return '시작일과 종료일을 모두 입력해주세요.';
    if (data.end_date < data.start_date) return '종료일은 시작일보다 빠를 수 없습니다.';
    if (data.medicines.length === 0) return '약을 1개 이상 등록해주세요.';
    for (let i = 0; i < data.medicines.length; i += 1) {
      const m = data.medicines[i];
      if (!m.medicine_name) return `약 ${i + 1}의 이름을 입력해주세요.`;
      if (!m.dose_amount) return `약 ${i + 1}의 1회 복용량을 입력해주세요.`;
    }
    return null;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearFormError();
    resultCard.classList.add('hidden');

    const formData = new FormData(form);
    const data = {
      times: formData.getAll('times'),
      start_date: formData.get('start_date') || '',
      end_date: formData.get('end_date') || '',
      medicines: collectMedicines(),
    };

    const clientError = validate(data);
    if (clientError) {
      showFormError(clientError);
      return;
    }

    const apiKey = getStoredKey();
    if (!apiKey) {
      invalidateKey('API 키를 입력해주세요.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '생성 중...';

    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(data),
      });
      const body = await res.json();

      if (res.status === 401) {
        invalidateKey('API 키가 올바르지 않습니다.');
        return;
      }

      if (!res.ok || !body.success) {
        showFormError((body.error && body.error.message) || '요청 처리 중 오류가 발생했습니다.');
        return;
      }

      resultImage.src = body.data.qr_image;
      resultUrl.textContent = body.data.qr_url;
      resultDownload.href = body.data.qr_image;
      resultCard.classList.remove('hidden');
      resultCard.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showFormError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'QR 생성하기';
    }
  });
})();
