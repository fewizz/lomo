#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/hash.glsl

/* lomo:pipeline/post/compute_normal.glsl */

vec3 compute_normal(
	vec3 incidence, vec3 normal, vec2 pos, float roughness, uint stp
) {
	vec3 resulting_normal;
	for(int i = 0; i < 8; ++i) {
	vec2 rand = (hash24(uvec4(
		pos, frx_renderFrames % 65536 + stp * 1024 + i, stp * 256 + i
	)) * 2.0 - 1.0);

	vec3 reflected = reflect(incidence, normal);
	vec3 reflected0 = reflected;
	vec3 cr = cross(incidence, normal);
	if(cr == vec3(0.0)) {
		cr = cross(incidence, vec3(1.0, 0.0, 0.0));
	}
	cr = normalize(cr);
	float s = sign(rand.x);
	//rand.x = abs(rand.x);
	reflected = rotation(
		pow(abs(rand.x), 1.0 / roughness) * pow(roughness, 1.5) * s * PI,
		//(1.0 - sqrt(1.0 - pow(rand.x, 2.0))) * PI,
		cr
	) * reflected;

	reflected = rotation(rand.y * PI, reflected0) * reflected;

	resulting_normal = normalize(-incidence + reflected);
	if(resulting_normal == vec3(0.0)) {
		resulting_normal = reflected;
	}

	if(dot(reflected, normal) > 0.0) {
		break;
	}

	}
	return resulting_normal;
}