#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl

/* lomo:pipeline/post/compute_normal.glsl */

vec3 compute_normal(
	vec3 incidence, vec3 geometric_normal, vec2 pos, float roughness, uint stp
) {
	vec3 normal;
	for(int i = 0; i < 4; ++i) {
	vec2 rand = (hash24(uvec4(
		pos, frx_renderFrames % 4096 + stp * 256 + i, stp * 256 + i
	)) * 2.0 - 1.0);

	vec3 reflected = reflect(incidence, geometric_normal);
	vec3 reflected0 = reflected;
	vec3 cr = cross(incidence, geometric_normal);
	if(cr == vec3(0.0)) {
		cr = cross(incidence, vec3(1.0, 0.0, 0.0));
	}
	cr = normalize(cr);
	//roughness = pow(roughness, 1.0);
	float s = sign(rand.x);
	rand.x = abs(rand.x);
	reflected = rotation(
		//(
		//	rand.x < 1.0 - roughness ? 0.0 : pow((rand.x - (1.0 -roughness)) / (1.0 - (1.0 - roughness)), 2.0)
		//) * s * PI,
		pow(abs(rand.x), 1.0 / roughness) * pow(roughness, 2.0) * s * PI,
		//(
		//	rand.x * pow(roughness, 4.0)//rand.x < 1.0 - roughness ? 0.0 : (rand.x - (1.0 -roughness)) / (1.0 - (1.0 - roughness))
		//) * s * PI,
		cr
	) * reflected;
	reflected = rotation(rand.y * PI, reflected0) * reflected;

	normal = normalize(-incidence + reflected);
	if(normal == vec3(0.0)) {
		normal = reflected;
	}

	if(dot(reflected, geometric_normal) > 0.0) {
		break;
	}

	}
	return normal;
}