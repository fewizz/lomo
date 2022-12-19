#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl
#include frex:shaders/lib/math.glsl

uniform samplerCube u_sky;

layout(location = 0) out vec3 face[6];

vec3 sky(vec3 dir) {
	int pw = frxu_lod - 1;
	vec3 perp_1 = vec3(dir.z, dir.x, dir.y);
	vec3 perp_2 = vec3(dir.y, dir.z, dir.x);

	float angle = PI / pow(2.0, float(9 - pw));

	//return textureLod(u_sky, dir, pw).rgb;
	return (
		textureLod(u_sky, dir, pw).rgb * 1.5 +
		textureLod(u_sky, rotation(+angle, perp_1) * dir, pw).rgb +
		textureLod(u_sky, rotation(-angle, perp_1) * dir, pw).rgb +
		textureLod(u_sky, rotation(+angle, perp_2) * dir, pw).rgb +
		textureLod(u_sky, rotation(-angle, perp_2) * dir, pw).rgb
	) / 5.5;
}

void main() {
	vec3 d = normalize(
		vec3(gl_FragCoord.xy / frxu_size.xy - 0.5, 0.5)
	);

	// sky function takes world-space view direction
	face[0] = sky(vec3( d.z, -d.y, -d.x));
	face[1] = sky(vec3(-d.z, -d.y,  d.x));
	face[2] = sky(vec3( d.x,  d.z,  d.y));
	face[3] = sky(vec3(-d.x, -d.z, -d.y));
	face[4] = sky(vec3( d.x, -d.y,  d.z));
	face[5] = sky(vec3(-d.x, -d.y, -d.z));
}