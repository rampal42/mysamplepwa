const nameInput = document.getElementById('nameInput');
const cameraButton = document.getElementById('cameraButton');
const uploadInput = document.getElementById('uploadInput');
const cameraView = document.getElementById('cameraView');
const cameraVideo = document.getElementById('cameraVideo');
const captureButton = document.getElementById('captureButton');
const retryAnalysisButton = document.getElementById('retryAnalysisButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const closeCameraButton = document.getElementById('closeCameraButton');
const processingOverlay = document.getElementById('processingOverlay');
const processingElapsed = document.getElementById('processingElapsed');
const cancelAnalysisButton = document.getElementById('cancelAnalysisButton');
const cameraStatus = document.getElementById('cameraStatus');
const photoPreview = document.getElementById('photoPreview');
const tokenUsage = document.getElementById('tokenUsage');
const foodAnalysis = document.getElementById('foodAnalysis');
const foodAnalysisSummary = document.getElementById('foodAnalysisSummary');
const foodItems = document.getElementById('foodItems');
const foodCalories = document.getElementById('foodCalories');
const mealAllowanceInputs = document.querySelectorAll('[data-meal-allowance]');
const mealAllowanceSection = document.getElementById('mealAllowanceSection');
const mealAllowanceComparisons = document.getElementById('mealAllowanceComparisons');
const activityTimeSection = document.getElementById('activityTimeSection');
const activityTimes = document.getElementById('activityTimes');
const settingsButton = document.getElementById('settingsButton');
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettingsButton = document.getElementById('closeSettingsButton');
const ageInput = document.getElementById('ageInput');
const sexInput = document.getElementById('sexInput');
const weightInput = document.getElementById('weightInput');
const heightFeetInput = document.getElementById('heightFeetInput');
const heightInchesInput = document.getElementById('heightInchesInput');
const exerciseInputs = document.querySelectorAll('input[name="preferredExercises"]');
const apiKeyInput = document.getElementById('apiKeyInput');
const openRouterModel = 'openrouter/free';
const foodAnalysisPrompt = `Check whether this image visibly contains food or a drink intended for consumption. If it does, identify each visible item and estimate its edible portion and calories from the image. Be conservative and explain uncertainty through approximate portions. Return only valid JSON in this exact shape: {"contains_food":true,"foods":[{"name":"food name","portion":"approximate portion","estimated_calories":123}],"note":"brief uncertainty note"}. Sum item calories yourself only if useful, but the app will calculate the displayed total from the item estimates. If no food or drink is visible, return {"contains_food":false,"foods":[],"note":"No food was identified."}. Do not invent hidden ingredients or claim precision from an image.`;
const exerciseMetValues = {
  Walking: 3.5,
  Running: 8.3,
  Cycling: 6.8,
  Swimming: 6,
  'Strength training': 3.5,
  'Bodyweight training': 3.8,
  Yoga: 2.5,
  Pilates: 3,
  Stretching: 2.3,
  Hiking: 6,
  Dance: 5,
  'Balance exercises': 2.3
};
const exerciseCalorieRateOutputs = document.querySelectorAll('[data-exercise-rate]');
let cameraStream;
let previewUrl;
let capturedPicture;
let cameraFacingMode = 'environment';
let analysisController;
let analysisStartedAt;
let processingTimer;

settingsOverlay.hidden = true;
settingsOverlay.setAttribute('aria-hidden', 'true');
apiKeyInput.value = localStorage.getItem('openRouterApiKey') || '';
nameInput.value = localStorage.getItem('userName') || '';
ageInput.value = localStorage.getItem('userAge') || '';
sexInput.value = localStorage.getItem('userSex') || '';
weightInput.value = localStorage.getItem('userWeight') || '';
heightFeetInput.value = localStorage.getItem('userHeightFeet') || '';
heightInchesInput.value = localStorage.getItem('userHeightInches') || '';
try {
  const savedExercises = JSON.parse(localStorage.getItem('preferredExercises') || '[]');
  if (Array.isArray(savedExercises)) {
    exerciseInputs.forEach(input => {
      input.checked = savedExercises.includes(input.value);
    });
  }
} catch {
  localStorage.removeItem('preferredExercises');
}
loadMealCalorieAllowances();
updateExerciseCalorieRates();

function loadMealCalorieAllowances() {
  let savedAllowances = {};
  try {
    savedAllowances = JSON.parse(localStorage.getItem('mealCalorieAllowances') || '{}');
  } catch {
    localStorage.removeItem('mealCalorieAllowances');
  }

  mealAllowanceInputs.forEach(input => {
    const savedValue = savedAllowances[input.dataset.mealAllowance];
    const numericValue = Number(savedValue);
    input.value = savedValue !== undefined && savedValue !== null && savedValue !== ''
      && Number.isFinite(numericValue) && numericValue >= 0
      ? numericValue
      : input.defaultValue;
  });
  saveMealCalorieAllowances();
}

function saveMealCalorieAllowances() {
  const allowances = {};
  mealAllowanceInputs.forEach(input => {
    const value = Number(input.value);
    if (input.value === '' || !Number.isFinite(value) || value < 0) {
      input.value = input.defaultValue;
    }
    allowances[input.dataset.mealAllowance] = Number(input.value);
  });
  localStorage.setItem('mealCalorieAllowances', JSON.stringify(allowances));
}

function updateExerciseCalorieRates() {
  const age = Number(ageInput.value);
  const weightKg = Number(weightInput.value) / 2.20462;
  const heightCm = (Number(heightFeetInput.value) * 12 + Number(heightInchesInput.value)) * 2.54;
  const isTeenager = age >= 10 && age <= 18;
  const hasValidProfile = age >= 10 && weightKg > 0 && Number.isFinite(age)
    && Number.isFinite(weightKg) && sexInput.value
    && (isTeenager || (heightCm > 0 && Number.isFinite(heightCm)));
  let basalCaloriesPerDay = 0;

  // Ages 10-18: Schofield weight-only BMR equations; weight is kg, result is kcal/day.
  // Source: Schofield WN. Hum Nutr Clin Nutr. 1985;39 Suppl 1:5-41. https://pubmed.ncbi.nlm.nih.gov/4044297/
  // Ages 19+: Mifflin-St Jeor REE equations; weight is kg, height is cm, result is kcal/day.
  // Derived from healthy adults aged 19-78; see Mifflin MD et al. Am J Clin Nutr. 1990;51(2):241-247. doi:10.1093/ajcn/51.2.241.
  // https://pubmed.ncbi.nlm.nih.gov/2305711/
  // For either equation, "Decline to State" uses the arithmetic mean of the male and female coefficients.
  if (hasValidProfile && isTeenager) {
    if (sexInput.value === 'Male') {
      basalCaloriesPerDay = 17.686 * weightKg + 658.2;
    } else if (sexInput.value === 'Female') {
      basalCaloriesPerDay = 13.384 * weightKg + 692.6;
    } else {
      basalCaloriesPerDay = 15.535 * weightKg + 675.4;
    }
  } else if (hasValidProfile) {
    const sexCoefficient = sexInput.value === 'Male' ? 5 : sexInput.value === 'Female' ? -161 : -78;
    basalCaloriesPerDay = Math.max(0, 10 * weightKg + 6.25 * heightCm - 5 * age + sexCoefficient);
  }
  const rates = {};

  if (hasValidProfile) {
    Object.entries(exerciseMetValues).forEach(([exercise, met]) => {
      rates[exercise] = Number((basalCaloriesPerDay * met / 1440).toFixed(2));
    });
    localStorage.setItem('exerciseCalorieRates', JSON.stringify(rates));
  } else {
    localStorage.removeItem('exerciseCalorieRates');
  }

  exerciseCalorieRateOutputs.forEach(output => {
    const rate = rates[output.dataset.exerciseRate];
    const unavailableMessage = age > 0 && age < 10
      ? 'No estimate available under age 10'
      : 'Complete profile for estimate';
    output.textContent = rate === undefined ? unavailableMessage : `${rate} kcal/min`;
  });
}

function setSettingsOpen(isOpen) {
  settingsOverlay.hidden = !isOpen;
  settingsOverlay.classList.toggle('is-open', isOpen);
  settingsOverlay.setAttribute('aria-hidden', String(!isOpen));
  settingsButton.setAttribute('aria-expanded', String(isOpen));

  if (isOpen) {
    nameInput.focus();
  }
}

function openSettings() {
  setSettingsOpen(true);
}

function closeSettings() {
  setSettingsOpen(false);
}

settingsButton.addEventListener('click', () => {
  if (settingsOverlay.hidden) {
    openSettings();
  } else {
    closeSettings();
  }
});

closeSettingsButton.addEventListener('click', event => {
  event.stopPropagation();
  closeSettings();
});

settingsOverlay.addEventListener('click', event => {
  if (event.target === settingsOverlay) {
    closeSettings();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !settingsOverlay.hidden) {
    closeSettings();
  }
});

nameInput.addEventListener('input', () => {
  localStorage.setItem('userName', nameInput.value.trim());
});

ageInput.addEventListener('change', () => {
  localStorage.setItem('userAge', ageInput.value);
  updateExerciseCalorieRates();
});

sexInput.addEventListener('change', () => {
  localStorage.setItem('userSex', sexInput.value);
  updateExerciseCalorieRates();
});

weightInput.addEventListener('input', () => {
  localStorage.setItem('userWeight', weightInput.value);
  updateExerciseCalorieRates();
});

heightFeetInput.addEventListener('input', () => {
  localStorage.setItem('userHeightFeet', heightFeetInput.value);
  updateExerciseCalorieRates();
});

heightInchesInput.addEventListener('input', () => {
  localStorage.setItem('userHeightInches', heightInchesInput.value);
  updateExerciseCalorieRates();
});

exerciseInputs.forEach(input => {
  input.addEventListener('change', () => {
    const selectedExercises = Array.from(exerciseInputs)
      .filter(exerciseInput => exerciseInput.checked)
      .map(exerciseInput => exerciseInput.value);
    localStorage.setItem('preferredExercises', JSON.stringify(selectedExercises));
  });
});

mealAllowanceInputs.forEach(input => {
  input.addEventListener('input', () => {
    if (input.value !== '' && Number.isFinite(Number(input.value)) && Number(input.value) >= 0) {
      saveMealCalorieAllowances();
    }
  });
  input.addEventListener('change', saveMealCalorieAllowances);
});

apiKeyInput.addEventListener('input', () => {
  localStorage.setItem('openRouterApiKey', apiKeyInput.value.trim());
});

cameraButton.addEventListener('click', () => startCamera());

uploadInput.addEventListener('change', () => {
  const picture = uploadInput.files?.[0];
  uploadInput.value = '';

  if (!picture) {
    return;
  }

  if (!picture.type.startsWith('image/')) {
    cameraStatus.textContent = 'Choose an image file to analyze.';
    return;
  }

  setPictureForAnalysis(picture);
});

switchCameraButton.addEventListener('click', async () => {
  cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
});

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = 'Camera access is not supported by this browser.';
    return;
  }

  const previousFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';

  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = undefined;
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: cameraFacingMode } },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    cameraView.hidden = false;
    cameraButton.hidden = true;
    captureButton.hidden = false;
    switchCameraButton.hidden = false;
    switchCameraButton.textContent = cameraFacingMode === 'environment'
      ? 'Use front camera'
      : 'Use back camera';
    closeCameraButton.hidden = false;
    cameraStatus.textContent = '';
  } catch (error) {
    cameraFacingMode = previousFacingMode;
    stopCamera();
    cameraStatus.textContent = 'Unable to access the camera. Check browser permission and use HTTPS or localhost.';
  }
}

captureButton.addEventListener('click', () => {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    cameraStatus.textContent = 'The camera is still starting. Try again in a moment.';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  canvas.getContext('2d').drawImage(cameraVideo, 0, 0);

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  canvas.toBlob(picture => {
    if (!picture) {
      cameraStatus.textContent = 'The picture could not be captured.';
      return;
    }

    setPictureForAnalysis(picture);
  }, 'image/jpeg', 0.9);
});

closeCameraButton.addEventListener('click', stopCamera);
retryAnalysisButton.addEventListener('click', analyzeCapturedFood);
cancelAnalysisButton.addEventListener('click', cancelFoodAnalysis);

function setPictureForAnalysis(picture) {
  capturedPicture = picture;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(picture);
  photoPreview.src = previewUrl;
  photoPreview.hidden = false;
  retryAnalysisButton.hidden = true;
  foodAnalysis.hidden = true;
  foodItems.replaceChildren();
  foodCalories.hidden = true;
  tokenUsage.hidden = true;
  cameraStatus.textContent = '';
  stopCamera();
  analyzeCapturedFood();
}

async function analyzeCapturedFood() {
  if (!capturedPicture) {
    cameraStatus.textContent = 'Take a photo before requesting an analysis.';
    return;
  }

  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    retryAnalysisButton.hidden = false;
    openSettings();
    apiKeyInput.focus();
    cameraStatus.textContent = 'Enter an OpenRouter API key in Settings first.';
    return;
  }

  const controller = new AbortController();
  analysisController = controller;
  retryAnalysisButton.hidden = true;
  cameraStatus.textContent = '';
  foodAnalysis.hidden = true;
  tokenUsage.textContent = '';
  tokenUsage.hidden = true;
  showProcessingOverlay();

  try {
    const imageData = await blobToBase64(capturedPicture);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: foodAnalysisPrompt },
            {
              type: 'image_url',
              image_url: { url: `data:${capturedPicture.type};base64,${imageData}` }
            }
          ]
        }],
        usage: { include: true }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorResult = await response.json().catch(() => null);
      const providerMessage = errorResult?.error?.message;
      throw new Error(providerMessage || `API request failed with status ${response.status}`);
    }

    const result = await response.json();
    const messageContent = result.choices?.[0]?.message?.content;
    const responseText = typeof messageContent === 'string'
      ? messageContent
      : messageContent?.map(part => part.text).filter(Boolean).join(' ');

    if (!responseText) {
      throw new Error('The API returned no food analysis.');
    }

    const analysis = parseFoodAnalysis(responseText);
    renderFoodAnalysis(analysis);
    document.getElementById('foodAnalysisTitle').focus();
    const usage = result.usage;
    if (usage && Number.isFinite(usage.total_tokens)) {
      const inputTokens = Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : 0;
      const outputTokens = Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : 0;
      tokenUsage.textContent = `Tokens used: ${usage.total_tokens} (input: ${inputTokens}, output: ${outputTokens})`;
      tokenUsage.hidden = false;
    }
    cameraStatus.textContent = '';
  } catch (error) {
    if (!controller.signal.aborted) {
      cameraStatus.textContent = 'Unable to analyze this photo. Check your connection and API key, then try again.';
      retryAnalysisButton.hidden = false;
      console.error(error);
    }
  } finally {
    if (analysisController === controller) {
      analysisController = undefined;
      hideProcessingOverlay();
      if (!retryAnalysisButton.hidden) {
        retryAnalysisButton.focus();
      }
    }
  }
}

function showProcessingOverlay() {
  processingOverlay.hidden = false;
  processingOverlay.setAttribute('aria-hidden', 'false');
  analysisStartedAt = Date.now();
  updateProcessingElapsed();
  processingTimer = setInterval(updateProcessingElapsed, 1000);
  cancelAnalysisButton.focus();
}

function updateProcessingElapsed() {
  const elapsedSeconds = Math.floor((Date.now() - analysisStartedAt) / 1000);
  processingElapsed.textContent = `Processing time: ${elapsedSeconds} second${elapsedSeconds === 1 ? '' : 's'}`;
}

function hideProcessingOverlay() {
  clearInterval(processingTimer);
  processingTimer = undefined;
  processingOverlay.hidden = true;
  processingOverlay.setAttribute('aria-hidden', 'true');
}

function cancelFoodAnalysis() {
  if (!analysisController) {
    return;
  }

  analysisController.abort();
  analysisController = undefined;
  hideProcessingOverlay();
  retryAnalysisButton.hidden = false;
  cameraStatus.textContent = 'Analysis cancelled. Your photo is ready to retry.';
  retryAnalysisButton.focus();
}

function parseFoodAnalysis(responseText) {
  const jsonText = responseText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const analysis = JSON.parse(jsonText);

  if (typeof analysis.contains_food !== 'boolean' || !Array.isArray(analysis.foods)) {
    throw new Error('The API returned food analysis in an unexpected format.');
  }

  const foods = analysis.foods.map(food => ({
    name: typeof food.name === 'string' ? food.name.trim() : '',
    portion: typeof food.portion === 'string' ? food.portion.trim() : '',
    calories: Number(food.estimated_calories)
  })).filter(food => food.name && Number.isFinite(food.calories) && food.calories >= 0);

  if (analysis.contains_food && !foods.length) {
    throw new Error('The API did not return usable food calorie estimates.');
  }

  return { containsFood: analysis.contains_food, foods };
}

function renderFoodAnalysis(analysis) {
  foodItems.replaceChildren();
  activityTimes.replaceChildren();
  foodAnalysis.hidden = false;
  foodCalories.hidden = true;
  mealAllowanceSection.hidden = true;
  activityTimeSection.hidden = true;

  if (!analysis.containsFood) {
    foodAnalysisSummary.textContent = 'No food or drink was identified in this photo.';
    return;
  }

  const totalCalories = Math.round(analysis.foods.reduce((total, food) => total + food.calories, 0));
  foodAnalysisSummary.textContent = 'Estimated items and portions:';
  analysis.foods.forEach(food => {
    const item = document.createElement('li');
    const portion = food.portion ? ` (${food.portion})` : '';
    item.textContent = `${food.name}${portion}: about ${Math.round(food.calories)} kcal`;
    foodItems.append(item);
  });
  foodCalories.textContent = `Estimated total: about ${totalCalories} kcal`;
  foodCalories.hidden = false;
  renderMealAllowanceComparisons(totalCalories);
  renderActivityTimes(totalCalories);
}

function renderMealAllowanceComparisons(totalCalories) {
  mealAllowanceComparisons.replaceChildren();
  const allowances = {};
  mealAllowanceInputs.forEach(input => {
    allowances[input.dataset.mealAllowance] = Number(input.value);
  });

  Object.entries(allowances).forEach(([meal, allowance]) => {
    const difference = allowance - totalCalories;
    const comparison = difference >= 0
      ? `${totalCalories} of ${allowance} kcal (${Math.round(totalCalories / Math.max(allowance, 1) * 100)}%; ${difference} kcal remaining)`
      : `${totalCalories} kcal, ${Math.abs(difference)} kcal over the ${allowance} kcal allowance`;
    const item = document.createElement('li');
    item.textContent = `${meal[0].toUpperCase()}${meal.slice(1)}: ${comparison}`;
    mealAllowanceComparisons.append(item);
  });
  mealAllowanceSection.hidden = false;
}

function renderActivityTimes(totalCalories) {
  const selectedExercises = Array.from(exerciseInputs).filter(input => input.checked);
  if (!selectedExercises.length) {
    foodAnalysisSummary.textContent += ' Choose exercises in Settings to see activity-time comparisons.';
    return;
  }

  let rates = {};
  try {
    rates = JSON.parse(localStorage.getItem('exerciseCalorieRates') || '{}');
  } catch {
    localStorage.removeItem('exerciseCalorieRates');
  }

  const exercisesWithRates = selectedExercises.filter(input => Number(rates[input.value]) > 0);
  if (!exercisesWithRates.length) {
    const age = Number(localStorage.getItem('userAge'));
    foodAnalysisSummary.textContent += age > 0 && age < 10
      ? ' Activity estimates are unavailable under age 10.'
      : ' Complete your profile in Settings to see activity-time comparisons.';
    return;
  }

  exercisesWithRates.forEach(input => {
    const item = document.createElement('li');
    const minutes = Math.ceil(totalCalories / Number(rates[input.value]));
    item.textContent = `${input.value}: about ${minutes} min`;
    activityTimes.append(item);
  });
  activityTimeSection.hidden = false;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = undefined;
  }

  cameraVideo.srcObject = null;
  cameraView.hidden = true;
  cameraButton.hidden = false;
  captureButton.hidden = true;
  switchCameraButton.hidden = true;
  closeCameraButton.hidden = true;
}
