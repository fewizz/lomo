vec3 light_mix(
	vec3 inc_dir_cam, vec3 normal_cam_transformed,
	vec3 color, vec3 light, vec3 e,
	float roughness, float reflectance
) {
	vec3 V = -inc_dir_cam;
	vec3 N = normal_cam_transformed;
	float cs = max(0.0001, dot(V, N));

	/*******/ // From https://learnopengl.com/PBR/Theory
	float F0 = reflectance;
	float kS = F0 + (1.0 - F0) * pow(1.0 - cs, 5.0);
	kS = clamp(kS, 0.0, 1.0);
	/*******/
	kS = mix(kS, 0.0, roughness);
	float kD = 1.0 - kS;

	return e + (kD * color + kS * (1.0 - roughness)) * light;
}