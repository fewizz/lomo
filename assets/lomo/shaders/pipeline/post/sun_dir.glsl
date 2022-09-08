vec3 sun_dir() {
	float t = frx_skyAngleRadians + PI / 2.0;
	return vec3(cos(t), sin(t), 0);
}