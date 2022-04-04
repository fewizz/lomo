float rayleigh_phase_function(float cosa) {
	return 1./(4.*3.14) * 3./4. *(1.+cosa*cosa);
}

float henyey_greenstein_phase_function(float g, float cosa) {
	return 1./(4.*3.14) * (1.-g*g)/pow(1.+g*g-2.*g*cosa, 3./2.);
}