#include lomo:general

vec3 emitting_light(vec3 color, float block_light, float emissive) {
	return color *
		mix(
			1.0 * pow(block_light, 4),
			EMISSIVITY * length(color),
			clamp(emissive, 0.0, 1.0)
		);
}