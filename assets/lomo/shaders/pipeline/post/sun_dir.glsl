vec3 sun_dir() {
	float t = frx_skyAngleRadians + PI / 2.0;
	return rotation(0.0, vec3(0.0, 1.0, 0.0)) * vec3(cos(t), sin(t), 0);
}