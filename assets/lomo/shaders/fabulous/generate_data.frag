#include frex:shaders/api/view.glsl
#include lomo:shaders/lib/linear.glsl
#inlcude lomo:shaders/lib/pack.glsl

uniform sampler2D u_depth;

layout(location = 0) out uvec3 out_data;

void main() {
	/*float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	if(depth == 1.0) {
		out_data = uvec3(0u);
		return;
	}

	vec2 pos_win = gl_FragCoord.xy;
	vec3 pos_cam = win_to_cam(vec3(pos_win, depth));

	float xs[2] = float[2](
		texelFetch(u_depth, ivec2(pos_win) + ivec2(-1,  0), 0).r,
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 1,  0), 0).r
	);

	int closest_x = abs(depth - xs[0]) < abs(depth - xs[1]) ? 0 : 1;

	float ys[2] = float[2](
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 0, -1), 0).r,
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 0,  1), 0).r
	);

	int closest_y = abs(depth - ys[0]) < abs(depth - ys[1]) ? 0 : 1;

	vec3 x = win_to_cam(
		vec3(pos_win + vec2(closest_x * 2 - 1, 0.0), xs[closest_x])
	);

	vec3 y = win_to_cam(
		vec3(pos_win + vec2(0.0, closest_y * 2 - 1), ys[closest_y])
	);

	vec3 normal = normalize(cross(x - pos_cam, y - pos_cam));

	normal * sign(closest_x * 2 - 1) * sign(closest_y * 2 - 1);

	uint u_norm; {
		vec3 n = normal * 0.5 + 0.5;
		uint x = pack(n.x, 10u);
		uint y = pack(n.y, 10u) << 10;
		uint z = pack(n.z, 10u) << (10 + 10);
		u_norm = z | y | x;
	}*/

	out_data = uvec3(0u);
}