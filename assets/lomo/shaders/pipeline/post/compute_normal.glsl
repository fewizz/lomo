#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl

/* lomo:pipeline/post/compute_normal.glsl */

vec3 compute_normal(
	vec3 incidence, vec3 geometric_normal, vec2 pos, float roughness, uint stp
) {
	vec3 normal;
	for(int i = 0; i < 8; ++i) {
	vec2 rand = (hash24(uvec4(
		pos, frx_renderFrames % 4096 + i * 1024, stp
	)) * 2.0 - 1.0);

	vec3 reflected = reflect(incidence, geometric_normal);
	vec3 reflected0 = reflected;
	vec3 cr = normalize(cross(incidence, geometric_normal));
	//roughness = pow(roughness, 1.0);
	float s = sign(rand.x);
	reflected = rotation(
		pow(
			abs(rand.x),
			1.0 / (pow((roughness, 2.0) * 2, 4.0)) + 1.0 - 1.0 / 16.0
		) * pow(roughness, 3.0) * s * PI,
		cr
	) * reflected;
	reflected = rotation(rand.y * PI, reflected0) * reflected;

	normal = normalize(-incidence + reflected);
	if(dot(reflected, geometric_normal) > 0.0) {
		break;
	}

	}
	return normal;
}