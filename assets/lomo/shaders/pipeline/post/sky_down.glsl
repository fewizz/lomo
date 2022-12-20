#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/hash.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl

uniform samplerCube u_sky;

layout(location = 0) out vec3 face[6];

vec3 sky(mat3 z_to_w, vec3 dir) {
	int pw = frxu_lod - 1;
	//vec3 perp_1 = vec3(dir.z, dir.x, dir.y);
	//vec3 x = vec3(0.0, 1.0, 0.0);
	vec3 perp_x = normalize(vec3(-dir.z, 0.0, dir.x));
	vec3 perp_y = cross(dir, perp_x);

	mat3 m = mat3(perp_x, perp_y, dir);

	float angle = PI * 1.4 / pow(2.0, max(0.0, float(7 - pw)));

	const int steps = 5;

	vec3 result = vec3(0.0);

	int count = 0;

	for(int x = 0; x < steps; ++x) {
		for(int y = 0; y < steps; ++y) {
			//vec2 rand = hash34(uvec4(uvec3((dir + 10.0) * 1000.0), i)).xy;
			//rand = rand * 2.0 - 1.0;
			//vec3 r0 = rotation(angle * rand.x * PI, perp) * dir;
			//vec3 r1 = rotation(rand.y * PI, dir) * r0;
			vec2 c_pos = vec2(x, y) / vec2(steps - 1);
			c_pos = (1.0 - 1.0 / float(steps)) * (c_pos * 2.0 - 1.0);

			if(length(c_pos) > 1.0) {
				continue;
			}

			//vec3 rot_vec = vec3(sin(c_pos.y * angle), sin(-c_pos.x * angle), 0.0);
			//rot_vec = normalize(rot_vec);

			//vec3 r1 = rotation(angle * c_pos.y, ) * dir;
			vec3 r0 = rotation(angle * c_pos.y, vec3(1.0, 0.0, 0.0)) * vec3(0, 0, 1);
			vec3 r1 = rotation(angle * c_pos.x, cross(r0, vec3(1.0, 0.0, 0.0))) * r0;
			//vec3 r1 = rotation(angle * c_pos.x, cross(r0, perp)) * r0;

			//vec3 r0 = rotation(angle * c_pos.y, vec3(0.0, 1.0, 0.0)) * dir;
			//vec3 r1 = rotation(angle * c_pos.x, vec3(1.0, 0.0, 0.0)) * r0;

			result += textureLod(u_sky, z_to_w * (m * r1), pw).rgb;
			++count;
		}
	}

	return result / float(count);

	//return textureLod(u_sky, dir, pw).rgb;
	/*return (
		textureLod(u_sky, dir, pw).rgb * 1.5 +
		textureLod(u_sky, rotation(+angle, perp_1) * dir, pw).rgb +
		textureLod(u_sky, rotation(-angle, perp_1) * dir, pw).rgb +
		textureLod(u_sky, rotation(+angle, perp_2) * dir, pw).rgb +
		textureLod(u_sky, rotation(-angle, perp_2) * dir, pw).rgb
	) / 5.5;*/
}

void main() {
	// d is a direction to a positive Z

	vec3 d = normalize(
		vec3(gl_FragCoord.xy / frxu_size.xy - 0.5, 0.5)
	);
	d.y *= -1.0;

	const vec3 y_axis = vec3(0, 1, 0);
	const vec3 x_axis = vec3(1, 0, 0);

	// sky function takes world-space view direction
	face[0] = sky(rotation( PI / 2.0, y_axis), d);
	face[1] = sky(rotation(-PI / 2.0, y_axis), d);
	face[2] = sky(rotation(-PI / 2.0, x_axis), d);
	face[3] = sky(rotation( PI / 2.0, x_axis), d);
	face[4] = sky(mat3(1.0),                   d);
	face[5] = sky(rotation( PI,       y_axis), d);
}