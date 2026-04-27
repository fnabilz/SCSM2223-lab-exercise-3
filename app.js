// http://geocoding-api.openmeteo.com/v1/search
const searchButton = document.getElementById('search-button')
const retryButton = document.getElementById('retry-button')
const errorBanner = document.getElementById('error-banner')

const weatherConfig = {
  0:  { label: "Clear sky", icon: "☀️" },
  1:  { label: "Mainly clear", icon: "🌤️" },
  2:  { label: "Partly cloudy", icon: "⛅" },
  3:  { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Depositing rime fog", icon: "🌫️" },
  51: { label: "Drizzle: Light", icon: "🌦️" },
  53: { label: "Drizzle: Moderate", icon: "🌦️" },
  55: { label: "Drizzle: Dense", icon: "🌦️" },
  61: { label: "Rain: Slight", icon: "🌧️" },
  63: { label: "Rain: Moderate", icon: "🌧️" },
  65: { label: "Rain: Heavy", icon: "🌧️" },
  71: { label: "Snow: Slight", icon: "❄️" },
  73: { label: "Snow: Moderate", icon: "❄️" },
  75: { label: "Snow: Heavy", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Rain showers: Slight", icon: "🌦️" },
  81: { label: "Rain showers: Moderate", icon: "🌦️" },
  82: { label: "Rain showers: Violent", icon: "⛈️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { label: "Thunderstorm with heavy hail", icon: "⛈️" }
};

async function fetchWithTimeout(url, options = {}) {
    // Requirement 19: 10-second request timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10 seconds

    try {
        const response = await fetch(url, {signal: controller.signal});
        clearTimeout(id);

        // Requirement 16: Handle HTTP errors explicitly
        if (!response.ok) {
            displayError(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            displayError("Request timed out. Please try again.");
        }

    }
}

function getWeatherInfo(code) {
  return weatherConfig[code] || { label: "Unknown", icon: "❓" };
}

async function fetchLocalTime(timezoneString) {
    const timeDisplay = document.querySelector('.current-time');
    
    if (!timezoneString) {
        console.warn("No timezone string provided. Using browser fallback.");
        applyBrowserTimeFallback();
        return;
    }
    const worldTimeUrl = `https://worldtimeapi.org/api/timezone/${timezoneString}`;

    console.log(timezoneString)
    $.getJSON(worldTimeUrl)
        .done(function(data) {
            const localDate = new Date(data.datetime);
            const timeString = localDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            if (timeDisplay) {
                timeDisplay.textContent = timeDisplay.textContent + ` ${timeString}`;
            }
        })
        .fail(function() {
            console.error("WorldTimeAPI call failed. Falling back.");
            applyBrowserTimeFallback();
        })
        .always(function() {
            const completionTimestamp = new Date().toLocaleString();
            console.log(`[AJAX Finished] WorldTimeAPI request completed at: ${completionTimestamp}`);
        });
}

function applyBrowserTimeFallback() {
    const now = new Date();
    const fallbackTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // FIX 2: Define the element and remove the undefined $timeDisplay reference
    const timeDisplay = document.querySelector('.current-time');
    if (timeDisplay) {
        timeDisplay.textContent = timeDisplay.textContent + ` ${fallbackTime}`;
    }
}

function displayError(message) {
    errorBanner.querySelector(".error-span").textContent = message
    errorBanner.style.display = 'block';
}


async function getCoordinate(cityName) { 

    try { 

        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=10&language=en&format=json`
        const data = await fetchWithTimeout(url)
        if (!data.results || data.results.length === 0) {
            displayError(`No results found for "${cityName}". Please try again.`)
            return
        }
        return data.results[0]
    } 
    catch (error) { 
        displayError("Service unavailable. Please check your connection.")
    } 
}

async function setWeather(cityName) {
    try {
        const coordinates  = await getCoordinate(cityName)
        if (!coordinates) return

        const { latitude, longitude, name, timezone } = coordinates
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode`;
       
        const data = await fetchWithTimeout(weatherUrl)

        const weatherCard = document.querySelector(".weather-card")
        weatherCard.classList.toggle("skeleton", false)

        const now = new Date(data.current_weather.time);
        const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
        

        const currentCode = data.current_weather.weathercode;
        const { label, icon } = getWeatherInfo(currentCode);

        document.querySelector('.city-name').textContent = cityName; // You'd pass the name from geocoding here
        document.querySelector('.current-time').textContent = `${dayName},`
        document.querySelector('.temperature').textContent = `${Math.round(data.current_weather.temperature)}°C`
        document.querySelector('#humidity').textContent = `${data.hourly.relativehumidity_2m[0]}`
        document.querySelector('#wind').textContent = `${data.current_weather.windspeed} km/h`
        document.querySelector(".description").textContent = `${icon} ${label}`

        const dailyCodes = data.daily.weathercode

        const forecastCards = document.querySelectorAll(".forecast-card")
        forecastCards.forEach((card, index) => {
            card.classList.toggle("skeleton", false)

            const code = dailyCodes[index]
            const info = getWeatherInfo(code)
            const high = data.daily.temperature_2m_max[index]
            const low = data.daily.temperature_2m_min[index]

            card.querySelector('.high').textContent = `${Math.round(high)}°`
            card.querySelector('.low').textContent = `${Math.round(low)}°`
            card.querySelector('.weather-icon').textContent = `${info.icon}`
        })
        fetchLocalTime(timezone)
    } 
    catch (error) {
        displayError("Service unavailable. Please check your connection.")
    }
}

searchButton.addEventListener("click", (event) => {
    errorBanner.style.display = 'none';
    const cityName = document.getElementById("input-city")
    setWeather(cityName.value)
})

retryButton.addEventListener('click', (event) => {
    errorBanner.style.display = 'none';
    const cityName = document.getElementById("input-city")
    setWeather(cityName.value)
})

let debounceTimer;

document.getElementById('input-city').addEventListener('input', (e) => {
    const cityName = e.target.value.trim();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        
        // Requirement 17: Validation (Empty or < 2 characters)
        if (cityName.length < 2) {
            if (cityName.length > 0) {
                displayError("Please enter at least 2 characters.");
            }
            return; // Exit without making any API call
        }
    }, 500); 
});
