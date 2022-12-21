#include frex:shaders/api/world.glsl
#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/traverser.glsl

#include lomo:shaders/pipeline/post/sun_dir.glsl

layout(location = 0) out float out_non_shadowed;

uniform sampler2DArray u_shadow_map;

uniform sampler2D u_depth;

vec3 shadow_dist(int cascade, vec3 shadow_pos) {
	vec4 c = frx_shadowCenter(cascade);
	return abs((c.xyz - shadow_pos.xyz) / c.w);
}

int select_shadow_cascade(vec3 shadow_pos) {
	vec3 d3 = shadow_dist(3, shadow_pos);
	vec3 d2 = shadow_dist(2, shadow_pos);
	vec3 d1 = shadow_dist(1, shadow_pos);
	if (all(lessThan(d3, vec3(1.0)))) return 3;
	if (all(lessThan(d2, vec3(1.0)))) return 2;
	if (all(lessThan(d1, vec3(1.0)))) return 1;
	return 0;
}

void main() {
	float depth_win = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	if(depth_win == 1.0) {
		out_non_shadowed = 1.0;
		return;
	}

	vec3 pos_win = vec3(gl_FragCoord.xy, depth_win);
	vec3 pos_cam = vec3(win_to_cam(pos_win));
	vec3 pos_wrd = cam_to_wrd(pos_cam);

	vec4 pos_shd0 = frx_shadowViewMatrix * vec4(pos_wrd, 1.0);
	vec3 pos_shd = pos_shd0.xyz / pos_shd0.w;

	int cascade = select_shadow_cascade(pos_shd);

	vec4 pos_shd_ndc0 = frx_shadowProjectionMatrix(cascade) * vec4(pos_shd, 1.0);
	vec3 pos_shd_ndc = pos_shd_ndc0.xyz /= pos_shd_ndc0.w;
	vec3 pos_shd_win = pos_shd_ndc * 0.5 + 0.5;

	vec2 tex_size = vec2(1024);//textureSize(u_shadow_map, cascade).xy;

	pos_shd_win.xy *= tex_size;


	float radius = 0.0;
	float max_radius = 8.0 / pow(2.0, 3 - cascade);

	const int r_steps = 6;

	for(int x = 0; x < r_steps; ++x) {
		for(int y = 0; y < r_steps; ++y) {
			vec2 pos = vec2(x, y) / float(r_steps - 1);
			pos = pos * 2.0 - 1.0;

			pos *= max_radius;

			float d = texture(u_shadow_map, vec3(pos_shd_ndc.xy * 0.5 + 0.5 + pos / tex_size, cascade)).r;
			radius += pos_shd_win.z < d ? pos_shd_win.z / 1000.0 : pos_shd_win.z - d;
		}
	}

	radius *= max_radius;

	float result = 0.0;

	const int steps = 8;

	for(int x = 0; x < steps; ++x) {
		for(int y = 0; y < steps; ++y) {
			vec2 pos = vec2(x, y) / float(steps - 1);
			pos = pos * 2.0 - 1.0;

			pos *= radius;

			float d = texture(u_shadow_map, vec3(pos_shd_ndc.xy * 0.5 + 0.5 + pos / tex_size, cascade)).r;

			result += float(pos_shd_win.z > d);
		}
	}

	out_non_shadowed =
		//result0 / max_radius;
		1.0 - result / pow(steps, 2.0);
}